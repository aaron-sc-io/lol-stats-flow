import { renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useSnapshot } from "./use-snapshot"

describe("useSnapshot", () => {
  it("starts in the loading state, then resolves to the real committed snapshot", async () => {
    // Given the hook is mounted
    const { result } = renderHook(() => useSnapshot())

    // Then it starts loading
    expect(result.current.status).toBe("loading")

    // When the committed snapshot finishes loading
    await waitFor(() => expect(result.current.status).toBe("ready"))

    // Then it exposes the real patch + modeled champions
    expect(result.current.status === "ready" && result.current.snapshot.meta.patch).toBe("16.22.1")
    expect(
      result.current.status === "ready" &&
        result.current.snapshot.champions.some((c) => c.id === "Yasuo" && c.modeled),
    ).toBe(true)
  })
})
