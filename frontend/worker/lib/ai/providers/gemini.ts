import { AppError } from '../../errors'

function isModelUnavailableResponse(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false
  const error = (payload as { error?: unknown }).error
  if (!error || typeof error !== 'object') return false
  const errorRecord = error as { status?: unknown; code?: unknown; message?: unknown }
  const code = String(errorRecord.status ?? errorRecord.code ?? '').toLowerCase()
  const message = String(errorRecord.message ?? '').toLowerCase()
  return code.includes('not_found') || code.includes('model_not_found') || (message.includes('model') && (message.includes('not found') || message.includes('not available') || message.includes('unavailable')))
}

export interface GeminiOptions {
  apiKey: string
  model: string
  messages: Array<{ role: 'system' | 'user'; content: string }>
  maxTokens?: number
  temperature?: number
}

function extractGeminiText(data: any): string | undefined {
  if (!data || typeof data !== 'object') return undefined
  const candidates = data.candidates
  if (!Array.isArray(candidates) || candidates.length === 0) return undefined
  const parts = candidates[0]?.content?.parts
  if (!Array.isArray(parts) || parts.length === 0) return undefined
  const text = parts[0]?.text
  return typeof text === 'string' ? text : undefined
}

export async function requestGemini({
  apiKey,
  model,
  messages,
  maxTokens = 1200,
  temperature = 0.2,
}: GeminiOptions): Promise<{ text: string; httpStatus: number; durationMs: number }> {
  if (!apiKey) {
    throw new AppError(500, 'AI_CONFIG_ERROR', 'Gemini API key is not configured.')
  }

  const systemPrompt = messages.find((m) => m.role === 'system')?.content || ''
  const userPrompt = messages.find((m) => m.role === 'user')?.content || ''

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 25_000)
  const startTime = Date.now()

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: userPrompt }],
            },
          ],
          systemInstruction: systemPrompt
            ? {
                parts: [{ text: systemPrompt }],
              }
            : undefined,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature,
            maxOutputTokens: maxTokens,
          },
        }),
        signal: controller.signal,
      },
    )

    const durationMs = Date.now() - startTime

    if (!response.ok) {
      const status = response.status
      let errorPayload: unknown
      try {
        errorPayload = await response.json()
      } catch {
        errorPayload = undefined
      }
      if ((status === 400 || status === 404) && isModelUnavailableResponse(errorPayload)) {
        throw new AppError(502, 'AI_MODEL_UNAVAILABLE', 'Gemini model is unavailable.')
      }
      if (status === 429) {
        throw new AppError(
          429,
          'UPSTREAM_RATE_LIMITED',
          'Gemini is temporarily rate limited. Please wait and try again.',
        )
      }
      if (status === 401 || status === 403) {
        throw new AppError(500, 'AI_AUTH_ERROR', 'Gemini authentication failed.')
      }
      if (status >= 400 && status < 500) {
        throw new AppError(500, 'AI_REQUEST_ERROR', `Gemini request returned HTTP ${status}.`)
      }
      throw new AppError(502, 'UPSTREAM_ERROR', `Gemini returned HTTP ${status}.`)
    }

    const data = await response.json<any>()
    const text = extractGeminiText(data)
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new AppError(502, 'INVALID_AI_RESPONSE', 'Gemini returned no text content.')
    }

    return { text, httpStatus: response.status, durationMs }
  } catch (error) {
    if (error instanceof AppError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AppError(503, 'UPSTREAM_TIMEOUT', 'Gemini took too long to respond.')
    }
    throw new AppError(502, 'UPSTREAM_UNAVAILABLE', 'Gemini could not be reached.')
  } finally {
    clearTimeout(timer)
  }
}