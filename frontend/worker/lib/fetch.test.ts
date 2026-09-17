import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchJson } from './fetch'
import { AppError } from './errors'

describe('fetchJson', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('throws AppError with status 429, UPSTREAM_RATE_LIMITED, and provider-neutral message on HTTP 429', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 429,
    } as Response)

    try {
      await fetchJson('https://example.com/api', { method: 'POST' })
      expect.unreachable('Should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(AppError)
      const appError = error as AppError
      expect(appError.status).toBe(429)
      expect(appError.code).toBe('UPSTREAM_RATE_LIMITED')
      expect(appError.message).toBe('An upstream service is temporarily rate limited. Please wait and try again.')
    }
  })

  it('throws AppError with status 404 on HTTP 404', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
    } as Response)

    try {
      await fetchJson('https://example.com/api', { method: 'GET' })
      expect.unreachable('Should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(AppError)
      const appError = error as AppError
      expect(appError.status).toBe(404)
      expect(appError.code).toBe('UPSTREAM_ERROR')
      expect(appError.message).toBe('An upstream service returned HTTP 404.')
    }
  })

  it('throws AppError with status 502 on other HTTP error codes', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
    } as Response)

    try {
      await fetchJson('https://example.com/api', { method: 'GET' })
      expect.unreachable('Should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(AppError)
      const appError = error as AppError
      expect(appError.status).toBe(502)
      expect(appError.code).toBe('UPSTREAM_ERROR')
      expect(appError.message).toBe('An upstream service returned HTTP 500.')
    }
  })

  it('returns parsed json on HTTP 200', async () => {
    const payload = { message: 'hello' }
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => payload,
    } as unknown as Response)

    const result = await fetchJson('https://example.com/api', { method: 'GET' })
    expect(result).toEqual(payload)
  })
})