export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

interface CircuitStatus {
  consecutiveFailures: number
  lastFailureTime: number
  state: CircuitState
}

const FAILURE_THRESHOLD = 3
const COOLDOWN_MS = 30_000

const circuits = new Map<string, CircuitStatus>()

export function isCircuitAvailable(providerName: string): boolean {
  const status = circuits.get(providerName)
  if (!status || status.state === 'CLOSED') return true

  const now = Date.now()
  if (status.state === 'OPEN') {
    if (now - status.lastFailureTime >= COOLDOWN_MS) {
      status.state = 'HALF_OPEN'
      return true
    }
    return false
  }

  return true
}

export function recordCircuitSuccess(providerName: string): void {
  circuits.set(providerName, {
    consecutiveFailures: 0,
    lastFailureTime: 0,
    state: 'CLOSED',
  })
}

export function recordCircuitFailure(providerName: string): void {
  const current = circuits.get(providerName) || {
    consecutiveFailures: 0,
    lastFailureTime: 0,
    state: 'CLOSED',
  }
  const nextFailures = current.consecutiveFailures + 1
  const now = Date.now()

  if (nextFailures >= FAILURE_THRESHOLD || current.state === 'HALF_OPEN') {
    circuits.set(providerName, {
      consecutiveFailures: nextFailures,
      lastFailureTime: now,
      state: 'OPEN',
    })
  } else {
    circuits.set(providerName, {
      consecutiveFailures: nextFailures,
      lastFailureTime: now,
      state: 'CLOSED',
    })
  }
}

export function resetAllCircuits(): void {
  circuits.clear()
}