/**
 * Vitest setup for the "component" (jsdom) project. jsdom does not
 * implement `ResizeObserver`, which @xyflow/react requires to measure the
 * canvas pane — stub it so component tests can mount <ReactFlow /> at all.
 */
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver ??= ResizeObserverStub
