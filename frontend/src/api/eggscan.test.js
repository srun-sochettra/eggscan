import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scanGithub, battleGithub, getLeaderboard, getScanResult, deepDiveRepo } from './eggscan.js';

const BASE = '';

beforeEach(() => {
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('eggscan API', () => {
  describe('scanGithub', () => {
    it('fetches successfully and returns json', async () => {
      const mockData = { id: 1, result: 'success' };
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      const result = await scanGithub('testuser', 'brutal');
      expect(global.fetch).toHaveBeenCalledWith(`${BASE}/api/scan/testuser?mode=brutal`);
      expect(result).toEqual(mockData);
    });

    it('uses default honest mode when mode is not provided', async () => {
      const mockData = { id: 1, result: 'success' };
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      await scanGithub('testuser');
      expect(global.fetch).toHaveBeenCalledWith(`${BASE}/api/scan/testuser?mode=honest`);
    });

    it('encodes special characters in username and mode', async () => {
      const mockData = { id: 1, result: 'success' };
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      await scanGithub('test user', 'my mode?');
      expect(global.fetch).toHaveBeenCalledWith(`${BASE}/api/scan/test%20user?mode=my%20mode%3F`);
    });

    it('preserves the GitHub user-not-found error code', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: { code: 'GITHUB_USER_NOT_FOUND', message: 'GitHub user was not found.' } }),
      });

      await expect(scanGithub('testuser')).rejects.toMatchObject({
        code: 'GITHUB_USER_NOT_FOUND',
        message: 'GitHub user was not found.',
      });
    });

    it('preserves AI provider errors without username-specific guidance', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: { code: 'AI_PROVIDER_UNAVAILABLE', message: 'The AI analysis service is temporarily unavailable. Please try again shortly.' } }),
      });

      await expect(scanGithub('testuser')).rejects.toMatchObject({
        code: 'AI_PROVIDER_UNAVAILABLE',
        message: 'The AI analysis service is temporarily unavailable. Please try again shortly.',
      });
    });

    it('throws default error when response is not ok and json is invalid', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: async () => { throw new Error('invalid json'); },
      });

      await expect(scanGithub('testuser')).rejects.toThrow('Scan failed');
    });
  });

  describe('battleGithub', () => {
    it('fetches successfully and returns json', async () => {
      const mockData = { winner: 'user1' };
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      const result = await battleGithub('user1', 'user2');
      expect(global.fetch).toHaveBeenCalledWith(`${BASE}/api/battle?u1=user1&u2=user2`);
      expect(result).toEqual(mockData);
    });

    it('encodes special characters in usernames', async () => {
      const mockData = { winner: 'user1' };
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      await battleGithub('user 1', 'user/2');
      expect(global.fetch).toHaveBeenCalledWith(`${BASE}/api/battle?u1=user%201&u2=user%2F2`);
    });

    it('throws error with message from api when response is not ok', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Battle error' }),
      });

      await expect(battleGithub('user1', 'user2')).rejects.toThrow('Battle error');
    });

    it('throws default error when response is not ok and json is invalid', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: async () => { throw new Error('invalid json'); },
      });

      await expect(battleGithub('user1', 'user2')).rejects.toThrow('Battle failed');
    });
  });

  describe('getLeaderboard', () => {
    it('fetches successfully and returns json', async () => {
      const mockData = [{ username: 'user1', score: 100 }];
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      const result = await getLeaderboard();
      expect(global.fetch).toHaveBeenCalledWith(`${BASE}/api/leaderboard`);
      expect(result).toEqual(mockData);
    });

    it('throws error with message from api when response is not ok', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Leaderboard unavailable' }),
      });

      await expect(getLeaderboard()).rejects.toThrow('Leaderboard unavailable');
    });

    it('throws default error when response is not ok and json is invalid', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: async () => { throw new Error('invalid json'); },
      });

      await expect(getLeaderboard()).rejects.toThrow('Failed to fetch leaderboard');
    });
  });

  describe('getScanResult', () => {
    it('fetches successfully and returns json', async () => {
      const mockData = { id: 'scan123', status: 'completed' };
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      const result = await getScanResult('scan123');
      expect(global.fetch).toHaveBeenCalledWith(`${BASE}/api/scan/result/scan123`);
      expect(result).toEqual(mockData);
    });

    it('encodes special characters in id', async () => {
      const mockData = { id: 'scan/123', status: 'completed' };
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      await getScanResult('scan/123');
      expect(global.fetch).toHaveBeenCalledWith(`${BASE}/api/scan/result/scan%2F123`);
    });

    it('throws error with message from api when response is not ok', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Scan not found' }),
      });

      await expect(getScanResult('scan123')).rejects.toThrow('Scan not found');
    });

    it('throws default error when response is not ok and json is invalid', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: async () => { throw new Error('invalid json'); },
      });

      await expect(getScanResult('scan123')).rejects.toThrow('Scan failed');
    });
  });
});

describe('deepDiveRepo', () => {
  it('returns json when response is ok with default branch', async () => {
    const mockData = { summary: 'Repo summary' };
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    const result = await deepDiveRepo('testuser', 'testrepo');
    expect(result).toEqual(mockData);
    expect(fetch).toHaveBeenCalledWith(`${BASE}/api/scan/testuser/repo/testrepo`);
  });

  it('returns json when response is ok with custom branch', async () => {
    const mockData = { summary: 'Repo summary' };
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    const result = await deepDiveRepo('testuser', 'testrepo', 'develop');
    expect(result).toEqual(mockData);
    expect(fetch).toHaveBeenCalledWith(`${BASE}/api/scan/testuser/repo/testrepo?defaultBranch=develop`);
  });

  it('throws error when response is not ok', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Deep dive failed' }),
    });

    await expect(deepDiveRepo('testuser', 'testrepo')).rejects.toThrow('Deep dive failed');
  });
});
