/**
 * Memory Module Tests
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

const { storeMemory, searchMemories, getMemory, updateMemory, deleteMemory, getMemoryStats, getRecentMemories } = await import('../src/memory.js');

describe('Memory Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('storeMemory', () => {
    it('should store a basic memory', () => {
      const mockRun = jest.fn().mockReturnValue({ lastInsertRowid: 1 });
      mockDb.prepare.mockReturnValue({ run: mockRun });

      const result = storeMemory({ content: 'Test memory content' });

      expect(result.id).toBe(1);
      expect(result.content).toBe('Test memory content');
      expect(result.type).toBe('note');
      expect(result.confidence).toBe(0.8);
    });

    it('should store with all options', () => {
      const mockRun = jest.fn().mockReturnValue({ lastInsertRowid: 2 });
      mockDb.prepare.mockReturnValue({ run: mockRun });

      const result = storeMemory({
        content: 'Important decision',
        type: 'decision',
        tags: ['priority', 'architecture'],
        project: 'creative-ai',
        confidence: 0.95,
        source: 'planning-session'
      });

      expect(result.id).toBe(2);
      expect(result.type).toBe('decision');
      expect(result.tags).toEqual(['priority', 'architecture']);
      expect(result.project).toBe('creative-ai');
      expect(result.confidence).toBe(0.95);
      expect(result.source).toBe('planning-session');
    });
  });

  describe('searchMemories', () => {
    it('should search by content', () => {
      const mockAll = jest.fn().mockReturnValue([
        { id: 1, content: 'Found this pattern', type: 'pattern', tags: '[]' },
        { id: 2, content: 'Another match', type: 'note', tags: '[]' }
      ]);
      mockDb.prepare.mockReturnValue({ all: mockAll });

      const results = searchMemories('pattern');

      expect(results).toHaveLength(2);
    });

    it('should filter by type', () => {
      const mockAll = jest.fn().mockReturnValue([
        { id: 1, content: 'A decision', type: 'decision', tags: '[]' }
      ]);
      mockDb.prepare.mockReturnValue({ all: mockAll });

      const results = searchMemories('', { type: 'decision' });

      expect(mockAll).toHaveBeenCalled();
    });

    it('should filter by project', () => {
      const mockAll = jest.fn().mockReturnValue([
        { id: 1, content: 'Project specific', type: 'note', tags: '[]', project: 'test-project' }
      ]);
      mockDb.prepare.mockReturnValue({ all: mockAll });

      const results = searchMemories('', { project: 'test-project' });

      expect(mockAll).toHaveBeenCalled();
    });

    it('should parse tags from JSON', () => {
      const mockAll = jest.fn().mockReturnValue([
        { id: 1, content: 'Tagged memory', type: 'note', tags: '["important","work"]' }
      ]);
      mockDb.prepare.mockReturnValue({ all: mockAll });

      const results = searchMemories('');

      expect(results[0].tags).toEqual(['important', 'work']);
    });

    it('should respect limit', () => {
      const mockAll = jest.fn().mockReturnValue([]);
      mockDb.prepare.mockReturnValue({ all: mockAll });

      searchMemories('', { limit: 5 });

      // Check that limit is passed in query
      const query = mockAll.mock.calls[0][0];
      expect(query).toContain('LIMIT ?');
    });
  });

  describe('getMemory', () => {
    it('should return null for non-existent memory', () => {
      const mockGet = jest.fn().mockReturnValue(undefined);
      mockDb.prepare.mockReturnValue({ get: mockGet });

      const result = getMemory(999);

      expect(result).toBeNull();
    });

    it('should return memory and increment access count', () => {
      const mockRun = jest.fn();
      const mockGet = jest.fn().mockReturnValue({
        id: 5,
        content: 'Accessed memory',
        type: 'note',
        tags: '[]'
      });
      mockDb.prepare.mockReturnValue({ run: mockRun, get: mockGet });

      const result = getMemory(5);

      expect(result).not.toBeNull();
      expect(result.id).toBe(5);
      // Access count should be incremented
      expect(mockRun).toHaveBeenCalled();
    });

    it('should parse tags', () => {
      const mockRun = jest.fn();
      const mockGet = jest.fn().mockReturnValue({
        id: 6,
        content: 'Memory with tags',
        type: 'learning',
        tags: '["key","concept"]'
      });
      mockDb.prepare.mockReturnValue({ run: mockRun, get: mockGet });

      const result = getMemory(6);

      expect(result.tags).toEqual(['key', 'concept']);
    });
  });

  describe('updateMemory', () => {
    it('should return null for non-existent memory', () => {
      const mockRun = jest.fn().mockReturnValue({ changes: 0 });
      mockDb.prepare.mockReturnValue({ run: mockRun });

      const result = updateMemory(999, { content: 'New content' });

      expect(result).toBeNull();
    });

    it('should update allowed fields only', () => {
      const mockRun = jest.fn().mockReturnValue({ changes: 1 });
      const mockGet = jest.fn().mockReturnValue({
        id: 1,
        content: 'Updated',
        type: 'decision',
        tags: '["new"]',
        project: 'test',
        confidence: 0.9
      });
      mockDb.prepare.mockReturnValue({ run: mockRun, get: mockGet });

      const result = updateMemory(1, { 
        content: 'Updated',
        type: 'decision',
        confidence: 0.9
      });

      expect(result).not.toBeNull();
      expect(mockRun).toHaveBeenCalled();
    });

    it('should reject unknown fields', () => {
      const mockRun = jest.fn();
      mockDb.prepare.mockReturnValue({ run: mockRun });

      updateMemory(1, { unknownField: 'value' });

      // Should not call run with unknown field
      expect(mockRun).not.toHaveBeenCalled();
    });
  });

  describe('deleteMemory', () => {
    it('should return true when memory is deleted', () => {
      const mockRun = jest.fn().mockReturnValue({ changes: 1 });
      mockDb.prepare.mockReturnValue({ run: mockRun });

      const result = deleteMemory(1);

      expect(result).toBe(true);
    });

    it('should return false when memory does not exist', () => {
      const mockRun = jest.fn().mockReturnValue({ changes: 0 });
      mockDb.prepare.mockReturnValue({ run: mockRun });

      const result = deleteMemory(999);

      expect(result).toBe(false);
    });
  });

  describe('getMemoryStats', () => {
    it('should return comprehensive stats', () => {
      const mockGet = jest.fn()
        .mockReturnValueOnce({ count: 25 }) // total
        .mockReturnValueOnce([{ type: 'note', count: 10 }, { type: 'decision', count: 8 }]) // byType
        .mockReturnValueOnce([{ id: 1, content: 'Top memory', access_count: 50 }]); // topAccessed

      mockDb.prepare.mockReturnValue({ get: mockGet });

      const stats = getMemoryStats();

      expect(stats.total).toBe(25);
      expect(stats.byType.note).toBe(10);
      expect(stats.byType.decision).toBe(8);
      expect(stats.topAccessed[0].access_count).toBe(50);
    });
  });

  describe('getRecentMemories', () => {
    it('should return recent memories ordered by creation date', () => {
      const mockAll = jest.fn().mockReturnValue([
        { id: 3, content: 'Recent 1', type: 'note', tags: '[]' },
        { id: 2, content: 'Recent 2', type: 'note', tags: '[]' },
        { id: 1, content: 'Older', type: 'note', tags: '[]' }
      ]);
      mockDb.prepare.mockReturnValue({ all: mockAll });

      const results = getRecentMemories(3);

      expect(results).toHaveLength(3);
      expect(results[0].id).toBe(3);
    });

    it('should respect limit', () => {
      const mockAll = jest.fn().mockReturnValue([]);
      mockDb.prepare.mockReturnValue({ all: mockAll });

      getRecentMemories(5);

      const query = mockAll.mock.calls[0][0];
      expect(query).toContain('LIMIT ?');
    });
  });
});