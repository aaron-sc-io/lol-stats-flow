import { AxeBuilder } from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

test("default canvas loads with no console errors and no serious/critical a11y violations", async ({
  page,
}) => {
  const consoleErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text())
    }
  })

  await page.goto("./")

  await expect(page.locator(".react-flow")).toBeVisible()
  await expect(page.getByText("lol-stats-flow")).toBeVisible()
  await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible()

  expect(consoleErrors).toEqual([])

  const accessibilityResults = await new AxeBuilder({ page }).analyze()
  const seriousOrCritical = accessibilityResults.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  )
  expect(seriousOrCritical).toEqual([])
})
