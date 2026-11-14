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

// `vitest.config.ts` does not set `test.globals: true` (every test file
// explicitly imports from "vitest" instead), so @testing-library/react's
// own auto-cleanup — which only fires when it finds a *global* `afterEach`
// — never registers. Without this, DOM from one test leaks into the next
// and multi-instance queries (`getByRole`) start matching more than one
// element. Register it explicitly instead.
afterEach(() => {
  cleanup()
})
