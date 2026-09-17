import { AppError } from '../../errors'

function isModelUnavailableResponse(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false
  const error = (payload as { error?: unknown }).error
  if (!error || typeof error !== 'object') return false
  const code = String((error as { code?: unknown }).code ?? '').toLowerCase()
  const message = String((error as { message?: unknown }).message ?? '').toLowerCase()
  return (
    code === 'model_not_found' ||
    code === 'model_unavailable' ||
    (message.includes('model') && (message.includes('does not exist') || message.includes('not found') || message.includes('unavailable') || message.includes('not available')))
  )
}

export interface OpenAiCompatibleOptions {
  providerName: string
  endpoint: string
  apiKey: string
  model: string
  messages: Array<{ role: 'system' | 'user'; content: string }>
  maxTokens?: number
  temperature?: number
  extraHeaders?: Record<string, string>
}

export async function requestOpenAiCompatible({
  providerName,
  endpoint,
  apiKey,
  model,
  messages,
  maxTokens = 1200,
  temperature = 0.2,
  extraHeaders = {},
}: OpenAiCompatibleOptions): Promise<{ text: string; httpStatus: number; durationMs: number }> {
  if (!apiKey) {
    throw new AppError(500, 'AI_CONFIG_ERROR', `${providerName} API key is not configured.`)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 25_000)
  const startTime = Date.now()

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        messages,
      }),
      signal: controller.signal,
    })

    const durationMs = Date.now() - startTime

    if (!response.ok) {
      const status = response.status
      let errorPayload: unknown
      try {
        const responseWithClone = response as Response & { clone?: () => Response }
        const errorResponse = typeof responseWithClone.clone === 'function' ? responseWithClone.clone() : response
        errorPayload = typeof errorResponse.json === 'function' ? await errorResponse.json() : undefined
      } catch {
        errorPayload = undefined
      }
      if ((status === 400 || status === 404) && isModelUnavailableResponse(errorPayload)) {
        throw new AppError(502, 'AI_MODEL_UNAVAILABLE', `${providerName} model is unavailable.`)
      }
      if (status === 429) {
        throw new AppError(
          429,
          'UPSTREAM_RATE_LIMITED',
          `${providerName} is temporarily rate limited. Please wait and try again.`,
        )
      }
      if (status === 401 || status === 403) {
        throw new AppError(500, 'AI_AUTH_ERROR', `${providerName} authentication failed.`)
      }
      if (status >= 400 && status < 500) {
        throw new AppError(500, 'AI_REQUEST_ERROR', `${providerName} request returned HTTP ${status}.`)
      }
      throw new AppError(502, 'UPSTREAM_ERROR', `${providerName} returned HTTP ${status}.`)
    }

    const data = await response.json<any>()
    const text = data?.choices?.[0]?.message?.content
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new AppError(502, 'INVALID_AI_RESPONSE', `${providerName} returned no text content.`)
    }

    return { text, httpStatus: response.status, durationMs }
  } catch (error) {
    if (error instanceof AppError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AppError(503, 'UPSTREAM_TIMEOUT', `${providerName} took too long to respond.`)
    }
    throw new AppError(502, 'UPSTREAM_UNAVAILABLE', `${providerName} could not be reached.`)
  } finally {
    clearTimeout(timer)
  }
}