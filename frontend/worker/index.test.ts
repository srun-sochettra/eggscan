import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import app from './index'
import type { Env } from './types'

describe('Worker API Endpoints with AI Fallback', () => {
  let fakeAi: { run: ReturnType<typeof vi.fn> }
  let fakeDb: { prepare: ReturnType<typeof vi.fn> }
  let fakeEnv: Env

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    fakeAi = {
      run: vi.fn(),
    }
    fakeDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({ success: true }),
      }),
    }
    fakeEnv = {
      DB: fakeDb as unknown as D1Database,
      AI: fakeAi as unknown as Ai,
      GITHUB_TOKEN: 'ghp_test_token',
      GROQ_API_KEY: 'gsk_test_key',
      GROQ_MODEL: 'openai/gpt-oss-120b',
      GEMINI_API_KEY: 'test-gemini-key',
      GEMINI_MODEL: 'gemini-2.5-flash',
      WORKERS_AI_MODEL: '@cf/meta/llama-3.1-8b-instruct-fp8',
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('GET /api/health returns 200 ok', async () => {
    const res = await app.request('/api/health', {}, fakeEnv)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ status: 'ok', service: 'eggscan-worker' })
  })

  it('invalid username returns 400 instead of 500', async () => {
    const res = await app.request('/api/scan/-bad--name-', {}, fakeEnv)
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'INVALID_INPUT' } })
  })

  it('battle against yourself is rejected', async () => {
    const res = await app.request('/api/battle?u1=octocat&u2=OctoCat', {}, fakeEnv)
    expect(res.status).toBe(400)
  })

  it('commit shame with no commits returns 404 instead of roasting nothing', async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      if (String(url).includes('api.github.com/users/octocat/repos')) return { ok: true, status: 200, json: async () => [] } as unknown as Response
      return { ok: false, status: 404 } as Response
    })
    const res = await app.request('/api/shame/commits/octocat', {}, fakeEnv)
    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'NO_COMMITS_FOUND' } })
  })

  it('GitHub profile 404 returns username-specific error code', async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      if (String(url).includes('api.github.com/users/missing-user')) return { ok: false, status: 404 } as Response
      return { ok: false, status: 404 } as Response
    })

    const res = await app.request('/api/scan/missing-user', {}, fakeEnv)
    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toEqual({
      error: { code: 'GITHUB_USER_NOT_FOUND', message: 'GitHub user was not found.' },
    })
  })

  it('transparently falls back to Gemini when Groq is rate-limited on shame/commits endpoint', async () => {
    // 1. Mock GitHub commits fetch
    vi.mocked(fetch).mockImplementation(async (url) => {
      const urlStr = String(url)
      if (urlStr.includes('api.github.com/users/octocat/repos')) {
        return { ok: true, status: 200, json: async () => [{ name: 'demo', fork: false, pushed_at: '2026-10-01T00:00:00Z' }] } as unknown as Response
      }
      if (urlStr.includes('api.github.com/repos/octocat/demo/commits')) {
        return { ok: true, status: 200, json: async () => [{ commit: { message: 'fix typo in docs' } }, { commit: { message: 'wip' } }] } as unknown as Response
      }
      if (urlStr.includes('api.groq.com')) {
        // Groq is rate limited
        return {
          ok: false,
          status: 429,
        } as Response
      }
      if (urlStr.includes('generativelanguage.googleapis.com')) {
        // Gemini succeeds
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        summary: 'Commit messages lack detail.',
                        lazinessScore: 78,
                        worstCommits: ['wip', 'fix typo in docs'],
                        roast: 'Writing wip is not a commit message.',
                      }),
                    },
                  ],
                },
              },
            ],
          }),
        } as unknown as Response
      }
      return { ok: false, status: 404 } as Response
    })

    const res = await app.request('/api/shame/commits/octocat', {}, fakeEnv)
    expect(res.status).toBe(200)
    const json = await res.json()

    expect(json).toEqual({
      summary: 'Commit messages lack detail.',
      lazinessScore: 78,
      worstCommits: ['wip', 'fix typo in docs'],
      roast: 'Writing wip is not a commit message.',
    })

    // Groq was called, Gemini was called, Workers AI was not called
    expect(fakeAi.run).not.toHaveBeenCalled()
  })

  it('returns sanitized error response when all AI providers fail', async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      const urlStr = String(url)
      if (urlStr.includes('api.github.com/users/octocat/repos')) {
        return { ok: true, status: 200, json: async () => [{ name: 'demo', fork: false, pushed_at: '2026-10-01T00:00:00Z' }] } as unknown as Response
      }
      if (urlStr.includes('api.github.com/repos/octocat/demo/commits')) {
        return { ok: true, status: 200, json: async () => [{ commit: { message: 'feat: add button' } }] } as unknown as Response
      }
      if (urlStr.includes('api.groq.com')) {
        return {
          ok: false,
          status: 429,
        } as Response
      }
      if (urlStr.includes('generativelanguage.googleapis.com')) {
        return {
          ok: false,
          status: 429,
        } as Response
      }
      return { ok: false, status: 404 } as Response
    })

    // Workers AI also fails
    fakeAi.run.mockResolvedValue({
      response: 'invalid json text from workers ai',
    })

    const res = await app.request('/api/shame/commits/octocat', {}, fakeEnv)
    expect(res.status).toBe(503)
    const json = await res.json()
    expect(json).toEqual({
      error: {
        code: 'AI_PROVIDER_UNAVAILABLE',
        message: 'The AI analysis service is temporarily unavailable. Please try again shortly.',
      },
    })
  })
})
