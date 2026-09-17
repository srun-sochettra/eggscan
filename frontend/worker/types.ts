export interface Env {
  DB: D1Database
  AI?: Ai
  GITHUB_TOKEN: string
  GROQ_API_KEY: string
  GROQ_MODEL: string
  GEMINI_API_KEY?: string
  GEMINI_MODEL?: string
  CEREBRAS_API_KEY?: string
  CEREBRAS_MODEL?: string
  NVIDIA_API_KEY?: string
  NVIDIA_MODEL?: string
  OPENROUTER_API_KEY?: string
  OPENROUTER_MODEL?: string
  WORKERS_AI_MODEL?: string
}

export type AppBindings = { Bindings: Env }