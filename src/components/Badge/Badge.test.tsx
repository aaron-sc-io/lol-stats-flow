import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Badge } from "./Badge"

describe("Badge", () => {
  it("renders its label text", () => {
    // Given a badge with text content
    render(<Badge>Not modeled</Badge>)

    // When queried by its text
    // Then it is present in the document
    expect(screen.getByText("Not modeled")).toBeTruthy()
  })
})
