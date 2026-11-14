/**
 * Shared HTTP helpers for the data pipeline: retrying fetch (exponential
 * backoff + jitter, for CDragon's documented flakiness/522s) and a small
 * concurrency limiter so we never fire more than N requests at once.
 */

export type RetryOptions = {
  readonly maxAttempts: number
  readonly baseDelayMs: number
  readonly maxDelayMs: number
  readonly timeoutMs: number
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 5,
  baseDelayMs: 500,
  maxDelayMs: 8_000,
  timeoutMs: 20_000,
}

export class FetchFailedError extends Error {
  readonly url: string
  readonly attempts: number
  override readonly cause: unknown

  constructor(url: string, attempts: number, cause: unknown) {
    super(`Failed to fetch ${url} after ${attempts} attempt(s): ${describeCause(cause)}`, { cause })
    this.name = "FetchFailedError"
    this.url = url
    this.attempts = attempts
    this.cause = cause
  }
}

function describeCause(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message
  }
  return String(cause)
}

function jitteredDelay(attempt: number, options: RetryOptions): number {
  const exponential = Math.min(options.maxDelayMs, options.baseDelayMs * 2 ** attempt)
  const jitter = Math.random() * exponential * 0.5
  return exponential * 0.5 + jitter
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchOnce(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`)
    }
    return response
  } finally {
    clearTimeout(timer)
  }
}

/** Fetches `url` as text, retrying transient failures with exponential
 * backoff + jitter. Throws `FetchFailedError` only after exhausting attempts. */
export async function fetchTextWithRetry(
  url: string,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS,
): Promise<string> {
  let lastError: unknown
  for (let attempt = 0; attempt < options.maxAttempts; attempt++) {
    try {
      const response = await fetchOnce(url, options.timeoutMs)
      return await response.text()
    } catch (error) {
      lastError = error
      if (attempt < options.maxAttempts - 1) {
        await sleep(jitteredDelay(attempt, options))
      }
    }
  }
  throw new FetchFailedError(url, options.maxAttempts, lastError)
}

/** Runs `tasks` with at most `limit` running concurrently, preserving order
 * of results. */
export async function runWithConcurrencyLimit<T>(
  tasks: ReadonlyArray<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex++
      const task = tasks[index]
      if (task === undefined) {
        return
      }
      results[index] = await task()
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker())
  await Promise.all(workers)
  return results
}
