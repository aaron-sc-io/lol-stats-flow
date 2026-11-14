import { afterEach, describe, expect, it, vi } from "vitest"
import { FetchFailedError, fetchTextWithRetry } from "./http"

function mockResponse(ok: boolean, status: number, body: string): Response {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    text: () => Promise.resolve(body),
  } as Response
}

describe("fetchTextWithRetry", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("Given a server that returns 522 twice then succeeds, when fetched with retry, then it returns the successful body", async () => {
    let call = 0
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        call++
        if (call <= 2) {
          return Promise.resolve(mockResponse(false, 522, "error code: 522"))
        }
        return Promise.resolve(mockResponse(true, 200, "ok-body"))
      }),
    )

    const result = await fetchTextWithRetry("https://example.test/data", {
      maxAttempts: 5,
      baseDelayMs: 1,
      maxDelayMs: 2,
      timeoutMs: 1000,
    })

    expect(result).toBe("ok-body")
    expect(call).toBe(3)
  })

  it("Given a server that always fails, when fetched with retry, then it throws FetchFailedError after exhausting maxAttempts with a clear message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(mockResponse(false, 522, "error code: 522"))),
    )

    await expect(
      fetchTextWithRetry("https://example.test/data", {
        maxAttempts: 3,
        baseDelayMs: 1,
        maxDelayMs: 2,
        timeoutMs: 1000,
      }),
    ).rejects.toThrow(FetchFailedError)
  })
})
