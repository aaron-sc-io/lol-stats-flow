import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Collapsible } from "./Collapsible"

describe("Collapsible", () => {
  it("is closed by default and opens the content region on click", () => {
    // Given a collapsible section closed by default
    render(
      <Collapsible label="Yasuo — Infinity Edge">
        <div>Q · W · E · R</div>
      </Collapsible>,
    )
    const trigger = screen.getByRole("button", { name: "Yasuo — Infinity Edge" })
    expect(trigger.getAttribute("aria-expanded")).toBe("false")

    // When the trigger is clicked
    fireEvent.click(trigger)

    // Then it reports expanded and the content is reachable
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    expect(screen.getByText("Q · W · E · R")).toBeTruthy()
  })

  it("honors defaultOpen", () => {
    // Given a collapsible section open by default
    render(
      <Collapsible label="Darius — Black Cleaver" defaultOpen>
        <div>Content</div>
      </Collapsible>,
    )

    // When queried immediately
    // Then it already reports expanded
    expect(
      screen.getByRole("button", { name: "Darius — Black Cleaver" }).getAttribute("aria-expanded"),
    ).toBe("true")
  })

  it("supports fully controlled usage via the open prop", () => {
    // Given a controlled collapsible and a change handler
    let openState = false
    const handleOpenChange = (next: boolean) => {
      openState = next
    }
    const { rerender } = render(
      <Collapsible label="Controlled" open={openState} onOpenChange={handleOpenChange}>
        <div>Body</div>
      </Collapsible>,
    )
    const trigger = screen.getByRole("button", { name: "Controlled" })
    expect(trigger.getAttribute("aria-expanded")).toBe("false")

    // When clicked, the callback reports the next state but the prop hasn't
    // changed yet, so the rendered state does not move on its own
    fireEvent.click(trigger)
    expect(openState).toBe(true)
    expect(trigger.getAttribute("aria-expanded")).toBe("false")

    // When the parent re-renders with the updated prop
    rerender(
      <Collapsible label="Controlled" open={openState} onOpenChange={handleOpenChange}>
        <div>Body</div>
      </Collapsible>,
    )

    // Then the component reflects it
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
  })
})
