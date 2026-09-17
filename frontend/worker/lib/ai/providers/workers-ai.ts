import { AppError } from '../../errors'

export interface WorkersAiOptions {
  ai: Ai
  model: string
  messages: Array<{ role: 'system' | 'user'; content: string }>
  maxTokens?: number
  temperature?: number
}

function extractWorkersAiText(response: unknown): string | undefined {
  if (typeof response === 'string') return response
  if (response && typeof response === 'object') {
    if ('response' in response && typeof (response as { response: unknown }).response === 'string') {
      return (response as { response: string }).response
    }
    if ('choices' in response && Array.isArray((response as { choices: unknown[] }).choices)) {
      const firstChoice = (response as { choices: Array<{ message?: { content?: unknown }; text?: unknown }> }).choices[0]
      if (typeof firstChoice?.message?.content === 'string') {
        return firstChoice.message.content
      }
      if (typeof firstChoice?.text === 'string') {
        return firstChoice.text
      }
    }
    if ('text' in response && typeof (response as { text: unknown }).text === 'string') {
      return (response as { text: string }).text
    }
  }
  return undefined
}

export async function requestWorkersAi({
  ai,
  model,
  messages,
  maxTokens = 1200,
  temperature = 0.2,
}: WorkersAiOptions): Promise<{ text: string; httpStatus: number; durationMs: number }> {
  if (!ai || typeof ai.run !== 'function') {
    throw new AppError(500, 'AI_CONFIG_ERROR', 'Cloudflare Workers AI binding is not configured.')
  }

  const startTime = Date.now()

  try {
    const response = await ai.run(model as any, {
      messages,
      max_tokens: maxTokens,
      temperature,
    })

    const durationMs = Date.now() - startTime
    const text = extractWorkersAiText(response)

    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new AppError(502, 'INVALID_AI_RESPONSE', 'Workers AI returned no text content.')
    }

    return { text, httpStatus: 200, durationMs }
  } catch (error) {
    if (error instanceof AppError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AppError(503, 'UPSTREAM_TIMEOUT', 'Workers AI took too long to respond.')
    }
    if (error && typeof error === 'object' && 'status' in error && (error as { status: number }).status === 429) {
      throw new AppError(429, 'UPSTREAM_RATE_LIMITED', 'Workers AI is temporarily rate limited. Please wait and try again.')
    }
    throw new AppError(502, 'UPSTREAM_ERROR', 'Workers AI service could not be reached.')
  }
}