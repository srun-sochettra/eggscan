import type { Context } from 'hono'
import { ZodError } from 'zod'

export class AppError extends Error {
  constructor(
    public readonly status: 400 | 401 | 403 | 404 | 429 | 500 | 502 | 503,
    public readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export function errorResponse(c: Context, error: unknown) {
  if (error instanceof AppError) {
    return c.json({ error: { code: error.code, message: error.message } }, error.status)
  }
  if (error instanceof ZodError) {
    return c.json({ error: { code: 'INVALID_INPUT', message: 'The request contains an invalid username, repository, branch, or option.' } }, 400)
  }
  console.error('Unhandled request failure', error)
  return c.json(
    { error: { code: 'INTERNAL_ERROR', message: 'The request could not be completed.' } },
    500,
  )
}
