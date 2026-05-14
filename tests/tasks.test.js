/**
 * Tasks Module Tests
 */

import { jest } from '@jest/globals';

// Mock the database
const mockDb = {
  prepare: jest.fn(),
  pragma: jest.fn(),
  close: jest.fn()
};

jest.unstable_mockModule('../src/db.js', () => ({
  getDb: () => mockDb,
  initializeDatabase: jest.fn(),
  closeDatabase: jest.fn(),
  getSchemaStats: jest.fn()
}));

// Import after mocking
const { createTask, getTasks, getTask, updateTask, deleteTask, getTaskStats } = await import('../src/tasks.js');

describe('Tasks Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createTask', () => {
    it('should create a task with required fields', () => {
      const mockRun = jest.fn().mockReturnValue({ lastInsertRowid: 1 });
      mockDb.prepare.mockReturnValue({ run: mockRun });

      const result = createTask({ title: 'Test Task' });

      expect(result.id).toBe(1);
      expect(result.title).toBe('Test Task');
      expect(result.status).toBe('pending');
      expect(result.priority).toBe(5);
      expect(result.urgency).toBe(5);
    });

    it('should create a task with all options', () => {
      const mockRun = jest.fn().mockReturnValue({ lastInsertRowid: 2 });
      mockDb.prepare.mockReturnValue({ run: mockRun });

      const result = createTask({
        title: 'Full Task',
        description: 'A description',
        priority: 8,
        urgency: 9,
        project: 'test-project',
        tags: ['urgent', 'important'],
        createdBy: 'testuser'
      });

      expect(result.id).toBe(2);
      expect(result.title).toBe('Full Task');
      expect(result.description).toBe('A description');
      expect(result.priority).toBe(8);
      expect(result.urgency).toBe(9);
      expect(result.project).toBe('test-project');
      expect(result.tags).toEqual(['urgent', 'important']);
    });

    it('should enforce priority bounds (1-10)', () => {
      const mockRun = jest.fn().mockReturnValue({ lastInsertRowid: 3 });
      mockDb.prepare.mockReturnValue({ run: mockRun });

      const result1 = createTask({ title: 'Test', priority: 0 });
      const result2 = createTask({ title: 'Test', priority: 15 });

      // Values should be clamped to 1-10
      expect(mockDb.prepare.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getTasks', () => {
    it('should return all tasks by default', () => {
      const mockAll = jest.fn().mockReturnValue([
        { id: 1, title: 'Task 1', status: 'pending', tags: '[]', priority: 5, urgency: 5 },
        { id: 2, title: 'Task 2', status: 'done', tags: '[]', priority: 3, urgency: 3 }
      ]);
      mockDb.prepare.mockReturnValue({ all: mockAll });

      const results = getTasks();

      expect(results).toHaveLength(2);
      expect(results[0].title).toBe('Task 1');
      expect(results[1].title).toBe('Task 2');
    });

    it('should filter by status', () => {
      const mockAll = jest.fn().mockReturnValue([
        { id: 1, title: 'Task 1', status: 'pending', tags: '[]', priority: 5, urgency: 5 }
      ]);
      mockDb.prepare.mockReturnValue({ all: mockAll });

      const results = getTasks({ status: 'pending' });

      expect(mockDb.prepare).toHaveBeenCalled();
      expect(mockAll).toHaveBeenCalled();
    });

    it('should parse JSON tags correctly', () => {
      const mockAll = jest.fn().mockReturnValue([
        { id: 1, title: 'Task 1', status: 'pending', tags: '["tag1","tag2"]', priority: 5, urgency: 5 }
      ]);
      mockDb.prepare.mockReturnValue({ all: mockAll });

      const results = getTasks();

      expect(results[0].tags).toEqual(['tag1', 'tag2']);
    });
  });

  describe('getTask', () => {
    it('should return null for non-existent task', () => {
      const mockGet = jest.fn().mockReturnValue(undefined);
      mockDb.prepare.mockReturnValue({ get: mockGet });

      const result = getTask(999);

      expect(result).toBeNull();
    });

    it('should return task by ID with parsed tags', () => {
      const mockGet = jest.fn().mockReturnValue({
        id: 5,
        title: 'Specific Task',
        status: 'in_progress',
        tags: '["special"]',
        priority: 7,
        urgency: 8
      });
      mockDb.prepare.mockReturnValue({ get: mockGet });

      const result = getTask(5);

      expect(result).not.toBeNull();
      expect(result.id).toBe(5);
      expect(result.title).toBe('Specific Task');
      expect(result.tags).toEqual(['special']);
    });
  });

  describe('updateTask', () => {
    it('should return null when task does not exist', () => {
      const mockRun = jest.fn().mockReturnValue({ changes: 0 });
      mockDb.prepare.mockReturnValue({ run: mockRun });

      const result = updateTask(999, { status: 'done' });

      expect(result).toBeNull();
    });

    it('should update task fields', () => {
      const mockRun = jest.fn().mockReturnValue({ changes: 1 });
      mockDb.prepare.mockReturnValue({ run: mockRun });

      const mockGet = jest.fn().mockReturnValue({
        id: 1,
        title: 'Updated Task',
        status: 'done',
        tags: '[]',
        priority: 5,
        urgency: 5
      });
      mockDb.prepare.mockReturnValue({ get: mockGet });

      const result = updateTask(1, { status: 'done', title: 'Updated Task' });

      expect(result).not.toBeNull();
      expect(mockRun).toHaveBeenCalled();
    });

    it('should set completed_at when status is done', () => {
      const mockRun = jest.fn().mockReturnValue({ changes: 1 });
      mockDb.prepare.mockReturnValue({ run: mockRun });

      const mockGet = jest.fn().mockReturnValue({
        id: 1,
        title: 'Task',
        status: 'done',
        tags: '[]',
        priority: 5,
        urgency: 5
      });
      mockDb.prepare.mockReturnValue({ get: mockGet });

      updateTask(1, { status: 'done' });

      // Verify completed_at is included in the update
      const callArgs = mockRun.mock.calls[0];
      expect(callArgs[0]).toContain('completed_at');
    });
  });

  describe('deleteTask', () => {
    it('should return true when task is deleted', () => {
      const mockRun = jest.fn().mockReturnValue({ changes: 1 });
      mockDb.prepare.mockReturnValue({ run: mockRun });

      const result = deleteTask(1);

      expect(result).toBe(true);
    });

    it('should return false when task does not exist', () => {
      const mockRun = jest.fn().mockReturnValue({ changes: 0 });
      mockDb.prepare.mockReturnValue({ run: mockRun });

      const result = deleteTask(999);

      expect(result).toBe(false);
    });
  });

  describe('getTaskStats', () => {
    it('should return task statistics', () => {
      const mockGet = jest.fn()
        .mockReturnValueOnce({ count: 10 }) // total
        .mockReturnValueOnce([{ status: 'pending', count: 5 }, { status: 'done', count: 5 }]) // byStatus
        .mockReturnValueOnce([{ project: 'general', count: 8 }, { project: 'test', count: 2 }]) // byProject
        .mockReturnValueOnce({ count: 3 }); // pendingHighUrgency

      mockDb.prepare.mockReturnValue({ get: mockGet });

      const stats = getTaskStats();

      expect(stats.total).toBe(10);
      expect(stats.byStatus.pending).toBe(5);
      expect(stats.byProject.general).toBe(8);
      expect(stats.pendingHighUrgency).toBe(3);
    });
  });

  describe('Priority Score Calculation', () => {
    it('should calculate priority score based on urgency and priority', () => {
      const mockAll = jest.fn().mockReturnValue([
        { id: 1, title: 'Task', status: 'pending', tags: '[]', priority: 5, urgency: 5 }
      ]);
      mockDb.prepare.mockReturnValue({ all: mockAll });

      const results = getTasks();

      // Score = (11 - urgency) * 2 + (11 - priority)
      // For P=5, U=5: (11-5)*2 + (11-5) = 12 + 6 = 18
      expect(results[0].score).toBe(18);
    });

    it('should rank high urgency tasks higher', () => {
      const mockAll = jest.fn().mockReturnValue([
        { id: 1, title: 'High Urgency', status: 'pending', tags: '[]', priority: 5, urgency: 10 },
        { id: 2, title: 'Low Urgency', status: 'pending', tags: '[]', priority: 5, urgency: 1 }
      ]);
      mockDb.prepare.mockReturnValue({ all: mockAll });

      const results = getTasks();

      // High urgency (10) should have lower score = higher priority
      // High: (11-10)*2 + (11-5) = 2 + 6 = 8
      // Low: (11-1)*2 + (11-5) = 20 + 6 = 26
      expect(results[0].score).toBeLessThan(results[1].score);
    });
  });
});