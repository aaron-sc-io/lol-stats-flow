import { AxeBuilder } from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

test.describe("component gallery", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./?view=gallery")
    await expect(
      page.getByRole("heading", { name: "lol-stats-flow — Component gallery" }),
    ).toBeVisible()
  })

  test("renders with zero serious/critical a11y violations", async ({ page }) => {
    const results = await new AxeBuilder({ page }).analyze()
    const seriousOrCritical = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    )
    expect(seriousOrCritical).toEqual([])
  })

  test("matches the full-page screenshot baseline", async ({ page }) => {
    await expect(page).toHaveScreenshot("gallery.png", { fullPage: true })
  })

  test("HoverPicker opens on hover within 300ms, filters by search, and supports Esc", async ({
    page,
  }) => {
    const trigger = page.getByRole("button", { name: "Choose champion" })
    const dialog = page.getByRole("dialog", { name: "Choose champion" })

    // Hover opens within the 150ms intent delay + margin.
    await trigger.hover()
    await expect(dialog).toBeVisible({ timeout: 300 })

    // Zero serious/critical a11y violations with the picker open.
    const openResults = await new AxeBuilder({ page }).analyze()
    const openSeriousOrCritical = openResults.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    )
    expect(openSeriousOrCritical).toEqual([])

    // Screenshot baseline of the open picker.
    await expect(dialog).toHaveScreenshot("gallery-picker-open.png")

    // All 60 fixture entries render before searching. Each item's visible
    // content is a monogram avatar ("01") plus the name ("Champion 1"), so
    // the accessible name is "01 Champion 1" (and disabled entries also
    // append "Not modeled") — match "Champion N" anywhere in the name.
    const items = dialog.getByRole("button", { name: /Champion \d+/ })
    await expect(items).toHaveCount(60)

    // Typing narrows the result count (only "Champion 60" contains "60").
    await dialog.getByRole("textbox", { name: "Search" }).fill("60")
    await expect(items).toHaveCount(1)
    await expect(items).toContainText("Champion 60")
    await dialog.getByRole("textbox", { name: "Search" }).fill("")

    // Clicking a disabled (unmodeled) entry does not select it. `force:
    // true` is required because Playwright's actionability check treats
    // `aria-disabled="true"` as non-clickable — exactly what this proves:
    // the click still reaches the DOM, but the component's own guard (not
    // the browser) is what keeps onSelect from firing.
    const selectedLabel = page.getByText("Selected: none")
    await expect(selectedLabel).toBeVisible()
    const disabledItem = dialog.getByRole("button", { name: /Champion 1( |$)/ })
    await expect(disabledItem).toHaveAttribute("aria-disabled", "true")
    await disabledItem.click({ force: true })
    await expect(selectedLabel).toBeVisible()

    // Esc closes the popover.
    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()
  })
})
