import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { Button } from "./Button"

describe("Button", () => {
  it("renders its label and fires onClick", () => {
    // Given a button with an onClick handler
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Save</Button>)

    // When clicked
    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    // Then the handler fires exactly once
    expect(onClick).toHaveBeenCalledOnce()
  })

  it("does not fire onClick while disabled", () => {
    // Given a disabled button
    const onClick = vi.fn()
    render(
      <Button onClick={onClick} disabled>
        Save
      </Button>,
    )

    // When clicked
    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    // Then the handler never fires
    expect(onClick).not.toHaveBeenCalled()
  })

  it.each([["primary"], ["secondary"], ["ghost"], ["danger"]] as const)(
    "renders the %s variant",
    (variant) => {
      // Given each supported variant
      render(<Button variant={variant}>Go</Button>)

      // When queried
      // Then it renders as a real <button> (variant styling is visual-only)
      expect(screen.getByRole("button", { name: "Go" }).tagName).toBe("BUTTON")
    },
  )
})
