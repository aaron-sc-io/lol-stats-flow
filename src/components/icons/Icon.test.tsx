import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ICON_NAMES, Icon } from "./Icon"

describe("Icon", () => {
  it("renders every registered icon name without throwing", () => {
    // Given the full set of registered icon names
    // When each is rendered
    // Then every one produces a non-empty <svg> with at least one child shape
    for (const name of ICON_NAMES) {
      const { container, unmount } = render(<Icon name={name} />)
      const svg = container.querySelector("svg")
      expect(svg, `icon "${name}" should render an <svg>`).toBeTruthy()
      expect(
        svg?.children.length ?? 0,
        `icon "${name}" should render at least one shape`,
      ).toBeGreaterThan(0)
      unmount()
    }
  })

  it("is aria-hidden and unfocusable by default (purely decorative)", () => {
    // Given an icon with no title
    const { container } = render(<Icon name="search" />)

    // When inspecting its accessibility attributes
    const svg = container.querySelector("svg")

    // Then it is hidden from assistive tech and keyboard focus
    expect(svg?.getAttribute("aria-hidden")).toBe("true")
    expect(svg?.getAttribute("focusable")).toBe("false")
  })

  it("exposes a title and img role when given meaningful content", () => {
    // Given an icon with a title
    const { container } = render(<Icon name="search" title="Search" />)

    // When inspecting its accessibility attributes
    const svg = container.querySelector("svg")

    // Then it is exposed as meaningful content instead of decorative
    expect(svg?.getAttribute("aria-hidden")).toBeNull()
    expect(svg?.getAttribute("role")).toBe("img")
    expect(svg?.querySelector("title")?.textContent).toBe("Search")
  })

  it("renders at the requested pixel size", () => {
    // Given an icon rendered at the large size
    const { container } = render(<Icon name="plus" size={24} />)

    // When inspecting its dimensions
    const svg = container.querySelector("svg")

    // Then both width and height match
    expect(svg?.getAttribute("width")).toBe("24")
    expect(svg?.getAttribute("height")).toBe("24")
  })
})
