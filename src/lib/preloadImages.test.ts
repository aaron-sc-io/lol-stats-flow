import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  clearPreloadedImageCacheForTest,
  preloadImages,
  scheduleIdlePreload,
} from "./preloadImages"

describe("preloadImages", () => {
  const createdSrcs: string[] = []
  let decodeCalls = 0
  const OriginalImage = globalThis.Image

  beforeEach(() => {
    createdSrcs.length = 0
    decodeCalls = 0
    clearPreloadedImageCacheForTest()

    class FakeImage {
      decoding = "auto"
      #src = ""
      get src(): string {
        return this.#src
      }
      set src(value: string) {
        this.#src = value
        createdSrcs.push(value)
      }
      decode(): Promise<void> {
        decodeCalls += 1
        return Promise.resolve()
      }
    }

    vi.stubGlobal("Image", FakeImage)
  })

  afterEach(() => {
    clearPreloadedImageCacheForTest()
    vi.stubGlobal("Image", OriginalImage)
    vi.restoreAllMocks()
  })

  it("creates an Image with async decoding for each unique non-empty URL and deduplicates across calls", () => {
    // Given a list of icon URLs with duplicates and an empty string
    const urls = [
      "https://cdn.example/yasuo.png",
      "https://cdn.example/vayne.png",
      "https://cdn.example/yasuo.png",
      "",
    ]

    // When preloadImages is called twice
    preloadImages(urls)
    preloadImages(["https://cdn.example/vayne.png", "https://cdn.example/garen.png"])

    // Then each unique URL is only instantiated and decoded once
    expect(createdSrcs).toEqual([
      "https://cdn.example/yasuo.png",
      "https://cdn.example/vayne.png",
      "https://cdn.example/garen.png",
    ])
    expect(decodeCalls).toBe(3)
  })

  it("scheduleIdlePreload runs during idle callback and can be cancelled before running", () => {
    // Given fake timers for the fallback idle scheduling
    vi.useFakeTimers()

    // When a preload is scheduled and cancelled before firing, and another is allowed to fire
    const cancelFirst = scheduleIdlePreload(() => ["https://cdn.example/cancelled.png"])
    cancelFirst()
    scheduleIdlePreload(() => ["https://cdn.example/scheduled.png"])
    vi.runAllTimers()

    // Then only the uncancelled preload executes
    expect(createdSrcs).toEqual(["https://cdn.example/scheduled.png"])
    vi.useRealTimers()
  })
})
