/**
 * Module-level cache of preloaded `HTMLImageElement` instances. Retaining the
 * references prevents the browser from garbage-collecting the decoded bitmap
 * entries before the user opens a HoverPicker popover, and deduplicates across
 * multiple pickers (e.g. six item-slot triggers sharing the same shop items).
 */
const preloadedImageCache = new Map<string, HTMLImageElement>()

/**
 * Eagerly requests and asynchronously decodes each image URL once. Repeated
 * calls with already-cached URLs are O(1) no-ops per URL.
 */
export function preloadImages(urls: Iterable<string>): void {
  if (typeof Image === "undefined") {
    return
  }
  for (const url of urls) {
    if (url.length === 0 || preloadedImageCache.has(url)) {
      continue
    }
    const img = new Image()
    img.decoding = "async"
    img.src = url
    preloadedImageCache.set(url, img)
    if (typeof img.decode === "function") {
      void img.decode().catch(() => {
        // Ignore decode errors in offline/test environments; the <img> element
        // will still follow normal browser fallback semantics when mounted.
      })
    }
  }
}

type IdleWindow = Window & {
  readonly requestIdleCallback?: ((callback: () => void) => number) | undefined
  readonly cancelIdleCallback?: ((handle: number) => void) | undefined
}

/**
 * Schedules image preloading during browser idle time (`requestIdleCallback`
 * with a `setTimeout` fallback) and returns a cleanup callback.
 */
export function scheduleIdlePreload(getUrls: () => Iterable<string>): () => void {
  if (typeof window === "undefined") {
    return () => {}
  }
  const idleWindow = window as IdleWindow
  if (typeof idleWindow.requestIdleCallback === "function") {
    const handle = idleWindow.requestIdleCallback(() => {
      preloadImages(getUrls())
    })
    return () => {
      idleWindow.cancelIdleCallback?.(handle)
    }
  }
  const timer = window.setTimeout(() => {
    preloadImages(getUrls())
  }, 1)
  return () => {
    window.clearTimeout(timer)
  }
}

/** Test-only helper to reset the module-level deduplication cache. */
export function clearPreloadedImageCacheForTest(): void {
  preloadedImageCache.clear()
}
