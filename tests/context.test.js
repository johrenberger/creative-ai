/**
 * Context Module Tests
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

const { setContext, getContext, getAllContext, deleteContext, setPreference, getPreference, getAllPreferences } = await import('../src/context.js');

describe('Context Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('setContext', () => {
    it('should set a string context value', () => {
      const mockRun = jest.fn();
      const mockGet = jest.fn().mockReturnValue({
        key: 'test-key',
        value: 'test-value',
        type: 'string',
        project: 'global'
      });
      mockDb.prepare.mockReturnValue({ run: mockRun, get: mockGet });

      const result = setContext('test-key', 'test-value');

      expect(mockRun).toHaveBeenCalledWith('test-key', 'test-value', 'string', 'global', 'system');
      expect(result.key).toBe('test-key');
      expect(result.value).toBe('test-value');
    });

    it('should store JSON for object values', () => {
      const mockRun = jest.fn();
      const mockGet = jest.fn().mockReturnValue({
        key: 'config',
        value: '{"theme":"dark","lang":"en"}',
        type: 'json',
        project: 'global'
      });
      mockDb.prepare.mockReturnValue({ run: mockRun, get: mockGet });

      const result = setContext('config', { theme: 'dark', lang: 'en' }, 'json');

      expect(mockRun).toHaveBeenCalled();
      expect(result.type).toBe('json');
    });

    it('should update existing key', () => {
      const mockRun = jest.fn();
      const mockGet = jest.fn().mockReturnValue({
        key: 'existing-key',
        value: 'new-value',
        type: 'string',
        project: 'global'
      });
      mockDb.prepare.mockReturnValue({ run: mockRun, get: mockGet });

      const result = setContext('existing-key', 'new-value');

      expect(mockRun).toHaveBeenCalled();
      expect(result.value).toBe('new-value');
    });

    it('should use custom project and updater', () => {
      const mockRun = jest.fn();
      const mockGet = jest.fn().mockReturnValue({
        key: 'my-key',
        value: 'my-value',
        type: 'string',
        project: 'my-project'
      });
      mockDb.prepare.mockReturnValue({ run: mockRun, get: mockGet });

      setContext('my-key', 'my-value', 'string', 'my-project', 'custom-user');

      expect(mockRun).toHaveBeenCalledWith('my-key', 'my-value', 'string', 'my-project', 'custom-user');
    });
  });

  describe('getContext', () => {
    it('should return null for non-existent key', () => {
      const mockGet = jest.fn().mockReturnValue(undefined);
      mockDb.prepare.mockReturnValue({ get: mockGet });

      const result = getContext('nonexistent');

      expect(result).toBeNull();
    });

    it('should return string context as-is', () => {
      const mockGet = jest.fn().mockReturnValue({
        key: 'string-key',
        value: 'plain string',
        type: 'string',
        project: 'global'
      });
      mockDb.prepare.mockReturnValue({ get: mockGet });

      const result = getContext('string-key');

      expect(result.value).toBe('plain string');
    });

    it('should parse JSON context', () => {
      const mockGet = jest.fn().mockReturnValue({
        key: 'json-key',
        value: '{"count":42,"active":true}',
        type: 'json',
        project: 'global'
      });
      mockDb.prepare.mockReturnValue({ get: mockGet });

      const result = getContext('json-key');

      expect(result.value).toEqual({ count: 42, active: true });
    });
  });

  describe('getAllContext', () => {
    it('should return all context entries', () => {
      const mockAll = jest.fn().mockReturnValue([
        { key: 'key1', value: 'value1', type: 'string', project: 'global' },
        { key: 'key2', value: 'value2', type: 'string', project: 'global' }
      ]);
      mockDb.prepare.mockReturnValue({ all: mockAll });

      const results = getAllContext();

      expect(results).toHaveLength(2);
    });

    it('should filter by project', () => {
      const mockAll = jest.fn().mockReturnValue([
        { key: 'proj-key', value: 'value', type: 'string', project: 'specific' }
      ]);
      mockDb.prepare.mockReturnValue({ all: mockAll });

      const results = getAllContext('specific');

      expect(mockAll).toHaveBeenCalled();
    });
  });

  describe('deleteContext', () => {
    it('should return true when key is deleted', () => {
      const mockRun = jest.fn().mockReturnValue({ changes: 1 });
      mockDb.prepare.mockReturnValue({ run: mockRun });

      const result = deleteContext('key-to-delete');

      expect(result).toBe(true);
    });

    it('should return false when key does not exist', () => {
      const mockRun = jest.fn().mockReturnValue({ changes: 0 });
      mockDb.prepare.mockReturnValue({ run: mockRun });

      const result = deleteContext('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('Preferences', () => {
    it('should set and get a preference', () => {
      const mockRun = jest.fn();
      const mockGet = jest.fn().mockReturnValue({ key: 'theme', value: 'dark' });
      mockDb.prepare.mockReturnValue({ run: mockRun, get: mockGet });

      setPreference('theme', 'dark');
      const result = getPreference('theme');

      expect(result).toBe('dark');
    });

    it('should return default value for missing preference', () => {
      const mockGet = jest.fn().mockReturnValue(undefined);
      mockDb.prepare.mockReturnValue({ get: mockGet });

      const result = getPreference('nonexistent', 'default-value');

      expect(result).toBe('default-value');
    });

    it('should return all preferences', () => {
      const mockAll = jest.fn().mockReturnValue([
        { key: 'theme', value: 'dark' },
        { key: 'language', value: 'en' }
      ]);
      mockDb.prepare.mockReturnValue({ all: mockAll });

      const results = getAllPreferences();

      expect(results).toEqual({ theme: 'dark', language: 'en' });
    });
  });
});