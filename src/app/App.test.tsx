import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { App } from "./App"

describe("App", () => {
  it("shows a loading state, then the top bar, patch indicator, and the default canvas", async () => {
    render(<App />)

    expect(screen.getByText("lol-stats-flow")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Open menu" })).toBeTruthy()
    expect(screen.getByText("Loading snapshot…")).toBeTruthy()

    await waitFor(() => expect(document.querySelector(".react-flow")).toBeTruthy())

    expect(screen.getByText("Patch 16.22.1")).toBeTruthy()
    // Default canvas: Yasuo (Champion) -> Combo -> Graph. Node content
    // (including the top bar's "Add node" button) is gated on the same
    // snapshotStatus === "ready" condition as `.react-flow`'s *children*,
    // but React Flow mounts its wrapper div a render ahead of populating
    // nodes — wait for the actual node content, not just the wrapper.
    await waitFor(() => expect(screen.getAllByText("Yasuo").length).toBeGreaterThan(0))
    expect(screen.getByRole("button", { name: "Add node" })).toBeTruthy()
  })
})
