/**
 * Vitest setup for the "component" (jsdom) project. jsdom does not
 * implement `ResizeObserver`, which @xyflow/react requires to measure the
 * canvas pane — stub it so component tests can mount <ReactFlow /> at all.
 */
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver ??= ResizeObserverStub

// jsdom also doesn't implement `DOMMatrixReadOnly`, which @xyflow/system
// uses internally to compute the viewport transform for `fitView()`.
// Without this, `fitView()` throws asynchronously (inside a `useEffect`,
// after React Flow's nodes have measured) — surfacing as an *unhandled*
// rejection attributed to whichever test happened to run last, not as a
// normal assertion failure. A plain identity-matrix stub is enough: tests
// only need the constructor not to throw, not real transform math.
class DOMMatrixReadOnlyStub {
  m11 = 1
  m12 = 0
  m13 = 0
  m14 = 0
  m21 = 0
  m22 = 1
  m23 = 0
  m24 = 0
  m31 = 0
  m32 = 0
  m33 = 1
  m34 = 0
  m41 = 0
  m42 = 0
  m43 = 0
  m44 = 1
}

globalThis.DOMMatrixReadOnly ??= DOMMatrixReadOnlyStub as unknown as typeof DOMMatrixReadOnly

// `vitest.config.ts` does not set `test.globals: true` (every test file
// explicitly imports from "vitest" instead), so @testing-library/react's
// own auto-cleanup — which only fires when it finds a *global* `afterEach`
// — never registers. Without this, DOM from one test leaks into the next
// and multi-instance queries (`getByRole`) start matching more than one
// element. Register it explicitly instead.
afterEach(() => {
  cleanup()
})
