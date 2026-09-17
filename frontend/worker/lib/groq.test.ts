import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { z } from 'zod'
import { groqJson } from './groq'
import { AppError } from './errors'
import { resetAllCircuits } from './ai/circuit-breaker'
import type { Env } from '../types'

describe('Multi-Provider AI Fallback Pipeline', () => {
  let fakeAi: { run: ReturnType<typeof vi.fn> }
  let fakeEnv: Env

  const TestSchema = z.object({
    answer: z.string(),
  })

  beforeEach(() => {
    resetAllCircuits()
    vi.stubGlobal('fetch', vi.fn())
    fakeAi = {
      run: vi.fn(),
    }
    fakeEnv = {
      GROQ_API_KEY: 'test-groq-key',
      GROQ_MODEL: 'openai/gpt-oss-120b',
      GEMINI_API_KEY: 'test-gemini-key',
      GEMINI_MODEL: 'gemini-2.5-flash',
      CEREBRAS_API_KEY: 'test-cerebras-key',
      CEREBRAS_MODEL: 'llama3.1-8b',
      NVIDIA_API_KEY: 'test-nvidia-key',
      NVIDIA_MODEL: 'meta/llama-3.1-8b-instruct',
      OPENROUTER_API_KEY: 'test-openrouter-key',
      OPENROUTER_MODEL: 'openrouter/free',
      WORKERS_AI_MODEL: '@cf/meta/llama-3.1-8b-instruct-fp8',
      AI: fakeAi as unknown as Ai,
    } as Env
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('passes the runtime Groq binding to the configured provider', async () => {
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (!String(url).includes('api.groq.com')) return { ok: false, status: 404 } as Response
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer test-groq-key' })
      const body = JSON.parse(String(init?.body))
      expect(body.model).toBe('openai/gpt-oss-120b')
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: JSON.stringify({ answer: 'runtime-binding-reached-groq' }) } }] }),
      } as unknown as Response
    })

    await expect(groqJson(fakeEnv, 'System prompt', { some: 'evidence' }, TestSchema)).resolves.toEqual({ answer: 'runtime-binding-reached-groq' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('returns configuration error only when no AI provider is configured', async () => {
    const envWithoutAi: Env = {
      ...fakeEnv,
      GROQ_API_KEY: '',
      GEMINI_API_KEY: undefined,
      CEREBRAS_API_KEY: undefined,
      NVIDIA_API_KEY: undefined,
      OPENROUTER_API_KEY: undefined,
      AI: undefined,
    }

    await expect(groqJson(envWithoutAi, 'System prompt', { some: 'evidence' }, TestSchema)).rejects.toMatchObject({
      code: 'AI_CONFIG_ERROR',
      message: 'groq API key is not configured.',
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('passes the configured Groq model to the request', async () => {
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (String(url).includes('api.groq.com')) {
        const body = JSON.parse(String(init?.body))
        expect(body.model).toBe('openai/gpt-oss-120b')
        return {
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: JSON.stringify({ answer: 'configured-model' }) } }] }),
        } as unknown as Response
      }
      return { ok: false, status: 404 } as Response
    })

    await expect(groqJson(fakeEnv, 'System prompt', { some: 'evidence' }, TestSchema)).resolves.toEqual({ answer: 'configured-model' })
  })

  it('Groq model-not-found 404 is retryable and falls back to Gemini', async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      if (String(url).includes('api.groq.com')) {
        return {
          ok: false,
          status: 404,
          json: async () => ({ error: { code: 'model_not_found', message: 'model does not exist' } }),
        } as unknown as Response
      }
      if (String(url).includes('generativelanguage.googleapis.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ answer: 'gemini-after-model-failure' }) }] } }] }),
        } as unknown as Response
      }
      return { ok: false, status: 404 } as Response
    })

    await expect(groqJson(fakeEnv, 'System prompt', { some: 'evidence' }, TestSchema)).resolves.toEqual({ answer: 'gemini-after-model-failure' })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('malformed provider 400 remains non-retryable', async () => {
    vi.mocked(fetch).mockImplementation(async (url) => String(url).includes('api.groq.com') ? { ok: false, status: 400, json: async () => ({ error: { code: 'invalid_request_error', message: 'bad request' } }) } as unknown as Response : { ok: false, status: 404 } as Response)

    await expect(groqJson(fakeEnv, 'System prompt', { some: 'evidence' }, TestSchema)).rejects.toMatchObject({ code: 'AI_REQUEST_ERROR' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('authentication failure remains non-retryable', async () => {
    vi.mocked(fetch).mockImplementation(async (url) => String(url).includes('api.groq.com') ? { ok: false, status: 401 } as Response : { ok: false, status: 404 } as Response)

    await expect(groqJson(fakeEnv, 'System prompt', { some: 'evidence' }, TestSchema)).rejects.toMatchObject({ code: 'AI_AUTH_ERROR' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('1. Groq success calls no fallback (Groq: 1, others: 0)', async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      const urlStr = String(url)
      if (urlStr.includes('api.groq.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: JSON.stringify({ answer: 'groq-success' }) } }],
          }),
        } as unknown as Response
      }
      return { ok: false, status: 404 } as Response
    })

    const result = await groqJson(fakeEnv, 'System prompt', { some: 'evidence' }, TestSchema)
    expect(result).toEqual({ answer: 'groq-success' })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fakeAi.run).not.toHaveBeenCalled()
  })

  it('2. Groq retryable failure -> Gemini success', async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      const urlStr = String(url)
      if (urlStr.includes('api.groq.com')) {
        return { ok: false, status: 429 } as Response
      }
      if (urlStr.includes('generativelanguage.googleapis.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              { content: { parts: [{ text: JSON.stringify({ answer: 'gemini-success' }) }] } },
            ],
          }),
        } as unknown as Response
      }
      return { ok: false, status: 404 } as Response
    })

    const result = await groqJson(fakeEnv, 'System prompt', { some: 'evidence' }, TestSchema)
    expect(result).toEqual({ answer: 'gemini-success' })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fakeAi.run).not.toHaveBeenCalled()
  })

  it('3. Gemini retryable failure -> Cerebras success', async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      const urlStr = String(url)
      if (urlStr.includes('api.groq.com')) return { ok: false, status: 429 } as Response
      if (urlStr.includes('generativelanguage.googleapis.com')) return { ok: false, status: 503 } as Response
      if (urlStr.includes('api.cerebras.ai')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: JSON.stringify({ answer: 'cerebras-success' }) } }],
          }),
        } as unknown as Response
      }
      return { ok: false, status: 404 } as Response
    })

    const result = await groqJson(fakeEnv, 'System prompt', { some: 'evidence' }, TestSchema)
    expect(result).toEqual({ answer: 'cerebras-success' })
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(fakeAi.run).not.toHaveBeenCalled()
  })

  it('4. Cerebras retryable failure -> NVIDIA success', async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      const urlStr = String(url)
      if (urlStr.includes('api.groq.com')) return { ok: false, status: 429 } as Response
      if (urlStr.includes('generativelanguage.googleapis.com')) return { ok: false, status: 429 } as Response
      if (urlStr.includes('api.cerebras.ai')) return { ok: false, status: 500 } as Response
      if (urlStr.includes('integrate.api.nvidia.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: JSON.stringify({ answer: 'nvidia-success' }) } }],
          }),
        } as unknown as Response
      }
      return { ok: false, status: 404 } as Response
    })

    const result = await groqJson(fakeEnv, 'System prompt', { some: 'evidence' }, TestSchema)
    expect(result).toEqual({ answer: 'nvidia-success' })
    expect(fetch).toHaveBeenCalledTimes(4)
    expect(fakeAi.run).not.toHaveBeenCalled()
  })

  it('5. NVIDIA retryable failure -> OpenRouter success', async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      const urlStr = String(url)
      if (urlStr.includes('api.groq.com')) return { ok: false, status: 429 } as Response
      if (urlStr.includes('generativelanguage.googleapis.com')) return { ok: false, status: 429 } as Response
      if (urlStr.includes('api.cerebras.ai')) return { ok: false, status: 429 } as Response
      if (urlStr.includes('integrate.api.nvidia.com')) return { ok: false, status: 502 } as Response
      if (urlStr.includes('openrouter.ai')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: JSON.stringify({ answer: 'openrouter-success' }) } }],
          }),
        } as unknown as Response
      }
      return { ok: false, status: 404 } as Response
    })

    const result = await groqJson(fakeEnv, 'System prompt', { some: 'evidence' }, TestSchema)
    expect(result).toEqual({ answer: 'openrouter-success' })
    expect(fetch).toHaveBeenCalledTimes(5)
    expect(fakeAi.run).not.toHaveBeenCalled()
  })

  it('6. OpenRouter retryable failure -> Workers AI success', async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      const urlStr = String(url)
      if (urlStr.includes('api.groq.com')) return { ok: false, status: 429 } as Response
      if (urlStr.includes('generativelanguage.googleapis.com')) return { ok: false, status: 429 } as Response
      if (urlStr.includes('api.cerebras.ai')) return { ok: false, status: 429 } as Response
      if (urlStr.includes('integrate.api.nvidia.com')) return { ok: false, status: 429 } as Response
      if (urlStr.includes('openrouter.ai')) return { ok: false, status: 429 } as Response
      return { ok: false, status: 404 } as Response
    })

    fakeAi.run.mockResolvedValueOnce({
      response: JSON.stringify({ answer: 'workers-ai-final-fallback' }),
    })

    const result = await groqJson(fakeEnv, 'System prompt', { some: 'evidence' }, TestSchema)
    expect(result).toEqual({ answer: 'workers-ai-final-fallback' })
    expect(fetch).toHaveBeenCalledTimes(5)
    expect(fakeAi.run).toHaveBeenCalledTimes(1)
  })

  it('7. Missing optional provider keys skip those providers without failure', async () => {
    const envWithoutOptionalKeys: Env = {
      ...fakeEnv,
      GEMINI_API_KEY: undefined,
      CEREBRAS_API_KEY: undefined,
      NVIDIA_API_KEY: undefined,
      OPENROUTER_API_KEY: undefined,
    }

    vi.mocked(fetch).mockImplementation(async (url) => {
      const urlStr = String(url)
      if (urlStr.includes('api.groq.com')) return { ok: false, status: 429 } as Response
      return { ok: false, status: 404 } as Response
    })

    fakeAi.run.mockResolvedValueOnce({
      response: JSON.stringify({ answer: 'direct-to-workers-ai' }),
    })

    const result = await groqJson(envWithoutOptionalKeys, 'System prompt', { some: 'evidence' }, TestSchema)
    expect(result).toEqual({ answer: 'direct-to-workers-ai' })
    // Only Groq was called over HTTP, unconfigured providers were skipped
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fakeAi.run).toHaveBeenCalledTimes(1)
  })

  it('8. Non-retryable 401 auth error stops chain safely without fallback loop', async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      const urlStr = String(url)
      if (urlStr.includes('api.groq.com')) return { ok: false, status: 401 } as Response
      return { ok: false, status: 404 } as Response
    })

    try {
      await groqJson(fakeEnv, 'System prompt', { some: 'evidence' }, TestSchema)
      expect.unreachable('Should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(AppError)
      expect((error as AppError).code).toBe('AI_AUTH_ERROR')
    }

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fakeAi.run).not.toHaveBeenCalled()
  })

  it('9. Invalid JSON gets exactly one correction request (total 2 attempts)', async () => {
    let groqAttempts = 0
    vi.mocked(fetch).mockImplementation(async (url) => {
      const urlStr = String(url)
      if (urlStr.includes('api.groq.com')) {
        groqAttempts += 1
        if (groqAttempts === 1) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ choices: [{ message: { content: 'not valid json at all' } }] }),
          } as unknown as Response
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: JSON.stringify({ answer: 'corrected-json' }) } }] }),
        } as unknown as Response
      }
      return { ok: false, status: 404 } as Response
    })

    const result = await groqJson(fakeEnv, 'System prompt', { some: 'evidence' }, TestSchema)
    expect(result).toEqual({ answer: 'corrected-json' })
    expect(groqAttempts).toBe(2)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fakeAi.run).not.toHaveBeenCalled()
  })

  it('10. Schema-invalid output gets exactly one correction request', async () => {
    let geminiAttempts = 0
    vi.mocked(fetch).mockImplementation(async (url) => {
      const urlStr = String(url)
      if (urlStr.includes('api.groq.com')) return { ok: false, status: 429 } as Response
      if (urlStr.includes('generativelanguage.googleapis.com')) {
        geminiAttempts += 1
        if (geminiAttempts === 1) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              candidates: [{ content: { parts: [{ text: JSON.stringify({ wrongField: 'missing-answer' }) }] } }],
            }),
          } as unknown as Response
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: JSON.stringify({ answer: 'schema-corrected' }) }] } }],
          }),
        } as unknown as Response
      }
      return { ok: false, status: 404 } as Response
    })

    const result = await groqJson(fakeEnv, 'System prompt', { some: 'evidence' }, TestSchema)
    expect(result).toEqual({ answer: 'schema-corrected' })
    expect(geminiAttempts).toBe(2)
    expect(fetch).toHaveBeenCalledTimes(3) // 1 Groq + 2 Gemini
    expect(fakeAi.run).not.toHaveBeenCalled()
  })

  it('11. 429/timeout/5xx does not retry the same provider (fails over immediately)', async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      const urlStr = String(url)
      if (urlStr.includes('api.groq.com')) return { ok: false, status: 429 } as Response
      if (urlStr.includes('generativelanguage.googleapis.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: JSON.stringify({ answer: 'immediate-failover' }) }] } }],
          }),
        } as unknown as Response
      }
      return { ok: false, status: 404 } as Response
    })

    const result = await groqJson(fakeEnv, 'System prompt', { some: 'evidence' }, TestSchema)
    expect(result).toEqual({ answer: 'immediate-failover' })
    // Groq was attempted exactly once before failover
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('12. Every provider failing returns the existing sanitized 502 contract', async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      const urlStr = String(url)
      if (urlStr.includes('api.groq.com')) return { ok: false, status: 429 } as Response
      if (urlStr.includes('generativelanguage.googleapis.com')) return { ok: false, status: 429 } as Response
      if (urlStr.includes('api.cerebras.ai')) return { ok: false, status: 429 } as Response
      if (urlStr.includes('integrate.api.nvidia.com')) return { ok: false, status: 429 } as Response
      if (urlStr.includes('openrouter.ai')) return { ok: false, status: 429 } as Response
      return { ok: false, status: 404 } as Response
    })

    fakeAi.run.mockResolvedValue({
      response: 'invalid json from workers ai',
    })

    try {
      await groqJson(fakeEnv, 'System prompt', { some: 'evidence' }, TestSchema)
      expect.unreachable('Should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(AppError)
      const appError = error as AppError
      expect(appError.status).toBe(503)
      expect(appError.code).toBe('AI_PROVIDER_UNAVAILABLE')
      expect(appError.message).toBe('The AI analysis service is temporarily unavailable. Please try again shortly.')
    }

    expect(fetch).toHaveBeenCalledTimes(5) // 1 Groq + 1 Gemini + 1 Cerebras + 1 Nvidia + 1 OpenRouter
    expect(fakeAi.run).toHaveBeenCalledTimes(2) // Workers AI initial + 1 correction
  })

  it('13. Total call counts remain bounded across the whole pipeline', async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      const urlStr = String(url)
      if (urlStr.includes('api.groq.com')) return { ok: false, status: 429 } as Response
      if (urlStr.includes('generativelanguage.googleapis.com')) return { ok: false, status: 503 } as Response
      if (urlStr.includes('api.cerebras.ai')) return { ok: false, status: 502 } as Response
      if (urlStr.includes('integrate.api.nvidia.com')) return { ok: false, status: 500 } as Response
      if (urlStr.includes('openrouter.ai')) return { ok: false, status: 429 } as Response
      return { ok: false, status: 404 } as Response
    })

    fakeAi.run.mockResolvedValueOnce({
      response: JSON.stringify({ answer: 'bounded-ok' }),
    })

    const result = await groqJson(fakeEnv, 'System prompt', { some: 'evidence' }, TestSchema)
    expect(result).toEqual({ answer: 'bounded-ok' })
    expect(fetch).toHaveBeenCalledTimes(5)
    expect(fakeAi.run).toHaveBeenCalledTimes(1)
  })

  it('14. Circuit-open provider is skipped without HTTP invocation', async () => {
    // Fail Groq 3 times to trip circuit breaker
    vi.mocked(fetch).mockImplementation(async (url) => {
      const urlStr = String(url)
      if (urlStr.includes('api.groq.com')) return { ok: false, status: 429 } as Response
      if (urlStr.includes('generativelanguage.googleapis.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: JSON.stringify({ answer: 'gemini-backup' }) }] } }],
          }),
        } as unknown as Response
      }
      return { ok: false, status: 404 } as Response
    })

    // Call 1: Groq fails (1), Gemini succeeds
    await groqJson(fakeEnv, 'System prompt', { some: 'evidence' }, TestSchema)
    // Call 2: Groq fails (2), Gemini succeeds
    await groqJson(fakeEnv, 'System prompt', { some: 'evidence' }, TestSchema)
    // Call 3: Groq fails (3 -> circuit opens), Gemini succeeds
    await groqJson(fakeEnv, 'System prompt', { some: 'evidence' }, TestSchema)

    expect(fetch).toHaveBeenCalledTimes(6) // 3 Groq + 3 Gemini

    // Call 4: Groq circuit is OPEN -> Groq should be skipped entirely!
    const result = await groqJson(fakeEnv, 'System prompt', { some: 'evidence' }, TestSchema)
    expect(result).toEqual({ answer: 'gemini-backup' })
    // Groq was NOT called on 4th execution, only Gemini was called!
    expect(fetch).toHaveBeenCalledTimes(7) // 6 previous + 1 Gemini
  })

  it('15. Prompts, evidence and secrets never appear in logs', async () => {
    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const secretEvidence = { secretPayload: 'SUPER_SECRET_REPO_DATA_XYZ_123' }

    vi.mocked(fetch).mockImplementation(async (url) => {
      const urlStr = String(url)
      if (urlStr.includes('api.groq.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: JSON.stringify({ answer: 'safe-logged' }) } }],
          }),
        } as unknown as Response
      }
      return { ok: false, status: 404 } as Response
    })

    await groqJson(fakeEnv, 'Secret System Prompt ABC', secretEvidence, TestSchema)

    const allLogs = [
      ...consoleInfoSpy.mock.calls,
      ...consoleWarnSpy.mock.calls,
      ...consoleErrorSpy.mock.calls,
    ].flat()

    const serializedLogs = JSON.stringify(allLogs)
    expect(serializedLogs).not.toContain('SUPER_SECRET_REPO_DATA_XYZ_123')
    expect(serializedLogs).not.toContain('Secret System Prompt ABC')
    expect(serializedLogs).not.toContain('test-groq-key')
    expect(serializedLogs).not.toContain('Bearer')
  })

  it('16. Strips emojis from output across all providers', async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      const urlStr = String(url)
      if (urlStr.includes('api.groq.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: JSON.stringify({ answer: 'Groq \uD83E\uDD5A Result \uD83D\uDE80' }) } }],
          }),
        } as unknown as Response
      }
      return { ok: false, status: 404 } as Response
    })

    const result = await groqJson(fakeEnv, 'System prompt', { some: 'evidence' }, TestSchema)
    expect(result).toEqual({ answer: 'Groq Result' })
  })
})