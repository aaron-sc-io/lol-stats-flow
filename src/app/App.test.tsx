import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { App } from "./App"

describe("App", () => {
  it("renders the top bar and an empty React Flow canvas", () => {
    render(<App />)

    expect(screen.getByText("lol-stats-flow")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Open menu" })).toBeTruthy()
    expect(document.querySelector(".react-flow")).toBeTruthy()
  })
})
