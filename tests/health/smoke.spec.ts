import { expect, type Page, test } from "@playwright/test"

/** Weekly deployed-site health check (plan §3.3.7, §7 Phase 6 AC): default
 * canvas renders, a share link round-trips, zero console errors. Runs
 * against the real GitHub Pages deployment (`playwright.health.config.ts`),
 * not a local build — if this fails, `health.yml` opens/updates an issue. */

async function interceptClipboard(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          ;(window as unknown as { __copiedText?: string }).__copiedText = text
        },
      },
    })
  })
}

async function readCopiedShareUrl(page: Page): Promise<string> {
  return page.evaluate(() => (window as unknown as { __copiedText?: string }).__copiedText ?? "")
}

test.describe("Deployed Pages health smoke", () => {
  test("Given the deployed site, when the default canvas loads, then it renders Yasuo with zero console errors", async ({
    page,
  }) => {
    const consoleErrors: string[] = []
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text())
    })
    page.on("pageerror", (err) => consoleErrors.push(err.message))

    await page.goto("./")
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText("Yasuo").first()).toBeVisible({ timeout: 15_000 })

    expect(consoleErrors, `console errors on deployed site: ${consoleErrors.join("; ")}`).toEqual(
      [],
    )
  })

  test("Given the default canvas, when a share link is generated, then it opens an identical canvas in a fresh context", async ({
    page,
    browser,
  }) => {
    await interceptClipboard(page)
    await page.goto("./")
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(300)

    const nodeCount = await page.locator('[data-testid^="rf__node-"]').count()

    await page.getByRole("button", { name: "Open menu" }).click()
    await page.getByRole("button", { name: "Copy share link" }).click()
    const shareUrl = await readCopiedShareUrl(page)
    expect(shareUrl).toContain("#c=")

    const freshContext = await browser.newContext()
    try {
      const freshPage = await freshContext.newPage()
      await freshPage.goto(shareUrl)
      await expect(freshPage.locator(".react-flow")).toBeVisible({ timeout: 15_000 })
      await expect(freshPage.locator('[data-testid^="rf__node-"]')).toHaveCount(nodeCount)
    } finally {
      await freshContext.close()
    }
  })
})
