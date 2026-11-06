import { AppError } from './errors'

export async function fetchJson<T>(url: string, init: RequestInit, timeoutMs = 12_000): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    if (!response.ok) {
      const rateLimitExhausted = response.status === 403 && response.headers?.get?.('x-ratelimit-remaining') === '0'
      if (response.status === 429 || rateLimitExhausted) {
        throw new AppError(429, 'UPSTREAM_RATE_LIMITED', 'An upstream service is temporarily rate limited. Please wait and try again.')
      }
      // GitHub answers 409 for empty repositories; treat that as missing content.
      const status = response.status === 404 || response.status === 409 ? 404 : 502
      throw new AppError(status, 'UPSTREAM_ERROR', `An upstream service returned HTTP ${response.status}.`)
    }
    return await response.json<T>()
  } catch (error) {
    if (error instanceof AppError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AppError(503, 'UPSTREAM_TIMEOUT', 'An upstream service took too long to respond.')
    }
    throw new AppError(502, 'UPSTREAM_UNAVAILABLE', 'An upstream service could not be reached.')
  } finally {
    clearTimeout(timer)
  }
}
