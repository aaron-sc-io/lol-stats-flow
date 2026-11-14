import { AxeBuilder } from "@axe-core/playwright"
import { expect, type Locator, type Page, test } from "@playwright/test"
import { CANVAS_V0_FIXTURE } from "@/persistence/__fixtures__/canvas-v0"

const DEFAULT_CHAMPION_ID = "champion-yasuo"
const CANVAS_KEY_PREFIX = "lol-stats-flow:canvas:"
const LAST_OPENED_KEY = "lol-stats-flow:last-opened"

function nodeById(page: Page, nodeId: string) {
  return page.locator(`[data-testid="rf__node-${nodeId}"]`)
}

function allNodes(page: Page) {
  return page.locator('[data-testid^="rf__node-"]')
}

/** Manual pointer-drag, same technique `tests/e2e/phase3.spec.ts` uses —
 * real intermediate pointermove events are what React Flow's own
 * connection/drag-threshold logic actually looks for. */
async function dragBetween(page: Page, source: Locator, target: Locator) {
  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()
  if (sourceBox === null || targetBox === null) {
    throw new Error("dragBetween: source or target handle is not visible")
  }
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
    steps: 12,
  })
  await page.mouse.up()
  await page.mouse.move(0, 0)
  await page.waitForTimeout(150)
}

async function fitViewNow(page: Page) {
  await page.getByRole("button", { name: "Fit View" }).click()
  await page.waitForTimeout(200)
}

async function gotoAndSettle(page: Page) {
  await page.goto("./")
  await expect(page.locator(".react-flow")).toBeVisible()
  await expect(page.getByText("Yasuo").first()).toBeVisible()
  await page.waitForTimeout(300)
  await fitViewNow(page)
}

/** Captures what the drawer's "Copy share link" writes, without needing
 * real OS clipboard permissions (flaky across CI/OS) — overriding
 * `navigator.clipboard.writeText` into a page-local global is the
 * standard Playwright technique for this. Must run via `addInitScript`
 * (before the page's own scripts touch `navigator.clipboard`). */
async function interceptClipboard(page: Page) {
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

test.describe("Phase 5 — persistence", () => {
  test("renaming the canvas and reloading restores the name and the added node", async ({
    page,
  }) => {
    await gotoAndSettle(page)

    const nameField = page.getByRole("textbox", { name: "Canvas name" })
    await nameField.fill("Reload Test Canvas")
    await nameField.blur()

    const nodesBefore = await allNodes(page).count()
    await page.getByRole("button", { name: "Add node" }).click()
    await page.getByRole("menuitem", { name: "Graph" }).click()
    await expect(allNodes(page)).toHaveCount(nodesBefore + 1)

    await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 3000 })

    await page.reload()
    await expect(page.locator(".react-flow")).toBeVisible()
    await expect(page.getByRole("textbox", { name: "Canvas name" })).toHaveValue(
      "Reload Test Canvas",
    )
    await expect(allNodes(page)).toHaveCount(nodesBefore + 1)
  })

  test("undo/redo across a node add, a new connection, and an item change", async ({ page }) => {
    test.setTimeout(60_000)
    await gotoAndSettle(page)

    const undoButton = page.getByRole("button", { name: "Undo", exact: true })
    const redoButton = page.getByRole("button", { name: "Redo", exact: true })
    await expect(undoButton).toBeDisabled()
    await expect(redoButton).toBeDisabled()

    await test.step("node add", async () => {
      const nodesBefore = await allNodes(page).count()
      await page.getByRole("button", { name: "Add node" }).click()
      await page.getByRole("menuitem", { name: "Combo" }).click()
      await expect(allNodes(page)).toHaveCount(nodesBefore + 1)

      await expect(undoButton).toBeEnabled()
      await undoButton.click()
      await expect(allNodes(page)).toHaveCount(nodesBefore)
      await expect(redoButton).toBeEnabled()
      await redoButton.click()
      await expect(allNodes(page)).toHaveCount(nodesBefore + 1)
      // Settle the burst-commit window before the next undo-able action.
      await page.waitForTimeout(600)
    })

    await test.step("connect", async () => {
      await fitViewNow(page)
      const edgesBefore = await page.locator(".react-flow__edge").count()
      const newCombo = page
        .locator('[data-testid^="rf__node-combo-"]:not([data-id="combo-1"])')
        .first()
      const championHandle = nodeById(page, DEFAULT_CHAMPION_ID)
        .locator('.react-flow__handle[data-handleid^="itemset:"]')
        .first()
      await dragBetween(page, championHandle, newCombo.locator(".react-flow__handle-left"))
      await expect(page.locator(".react-flow__edge")).toHaveCount(edgesBefore + 1)

      await expect(undoButton).toBeEnabled()
      await undoButton.click()
      await expect(page.locator(".react-flow__edge")).toHaveCount(edgesBefore)
      await redoButton.click()
      await expect(page.locator(".react-flow__edge")).toHaveCount(edgesBefore + 1)
      await page.waitForTimeout(600)
    })

    await test.step("item change", async () => {
      await fitViewNow(page)
      const champion = nodeById(page, DEFAULT_CHAMPION_ID)
      const emptySlot = champion.getByLabel(/slot 2: choose item/).first()
      await emptySlot.hover()
      const dialog = page.getByRole("dialog", { name: /slot 2: choose item/ })
      await expect(dialog).toBeVisible()
      await dialog.getByRole("textbox", { name: "Search" }).fill("Black Cleaver")
      await dialog.getByRole("button", { name: /Black Cleaver/ }).click()
      await expect(champion.getByLabel(/Remove Black Cleaver/)).toBeVisible()

      await expect(undoButton).toBeEnabled()
      await undoButton.click()
      await expect(champion.getByLabel(/slot 2: choose item/)).toBeVisible()
      await redoButton.click()
      await expect(champion.getByLabel(/Remove Black Cleaver/)).toBeVisible()
    })
  })

  test("share URL opens an identical canvas in a fresh browser context", async ({
    page,
    browser,
  }) => {
    await interceptClipboard(page)
    await gotoAndSettle(page)

    const nameField = page.getByRole("textbox", { name: "Canvas name" })
    await nameField.fill("Shared Canvas")
    await nameField.blur()
    await page.getByRole("button", { name: "Add node" }).click()
    await page.getByRole("menuitem", { name: "Graph" }).click()
    const nodeCount = await allNodes(page).count()
    await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 3000 })

    await page.getByRole("button", { name: "Open menu" }).click()
    await page.getByRole("button", { name: "Copy share link" }).click()
    const shareUrl = await readCopiedShareUrl(page)
    expect(shareUrl).toContain("#c=")

    const freshContext = await browser.newContext()
    try {
      const freshPage = await freshContext.newPage()
      await freshPage.goto(shareUrl)
      await expect(freshPage.locator(".react-flow")).toBeVisible()
      await expect(freshPage.getByRole("textbox", { name: "Canvas name" })).toHaveValue(
        "Shared Canvas",
      )
      await expect(allNodes(freshPage)).toHaveCount(nodeCount)
      // A decoded share link is a *new*, independent canvas, not a claim
      // to be the original's saved copy.
      const originalNameAfter = await nameField.inputValue()
      expect(originalNameAfter).toBe("Shared Canvas")
    } finally {
      await freshContext.close()
    }
  })

  test("loading a v0 fixture canvas migrates it to the current schema on load", async ({
    page,
  }) => {
    await page.addInitScript(
      ({ keyPrefix, lastOpenedKey, fixture }) => {
        window.localStorage.setItem(`${keyPrefix}${fixture.id}`, JSON.stringify(fixture))
        window.localStorage.setItem(lastOpenedKey, fixture.id)
      },
      { keyPrefix: CANVAS_KEY_PREFIX, lastOpenedKey: LAST_OPENED_KEY, fixture: CANVAS_V0_FIXTURE },
    )

    await page.goto("./")
    await expect(page.locator(".react-flow")).toBeVisible()
    await expect(page.getByText("Yasuo").first()).toBeVisible()

    await expect(page.getByRole("textbox", { name: "Canvas name" })).toHaveValue(
      CANVAS_V0_FIXTURE.name,
    )
    await expect(allNodes(page)).toHaveCount(CANVAS_V0_FIXTURE.graph.nodes.length)
    const fixtureComboNode = CANVAS_V0_FIXTURE.graph.nodes[1]
    await expect(nodeById(page, fixtureComboNode.id).locator("li")).toHaveCount(
      fixtureComboNode.data.steps.length,
    )

    // The migrated-and-rendered canvas is the proof that matters here —
    // `src/persistence/migrations.test.ts` already proves `migrateToLatest`
    // stamps `schemaVersion`/`patch` correctly in isolation. Opening a
    // canvas deliberately does not unconditionally rewrite it to disk
    // (that would bump `updatedAt` — and so its drawer sort position —
    // on a mere view, not an edit); it reaches disk again the first time
    // autosave fires on a real change, same as any other canvas.
  })

  test("drawer: 0 serious/critical a11y violations while open", async ({ page }) => {
    await gotoAndSettle(page)

    await page.getByRole("button", { name: "Open menu" }).click()
    await expect(page.getByRole("dialog", { name: "Canvases" })).toBeVisible()

    // Scoped to the drawer itself, not the whole page: the canvas behind
    // it is covered by `phase3.spec.ts`'s/`visual.spec.ts`'s own axe
    // checks, owned by the nodes/components that render it.
    const results = await new AxeBuilder({ page })
      .include('[role="dialog"][aria-label="Canvases"]')
      .analyze()
    const seriousOrCritical = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    )
    expect(seriousOrCritical).toEqual([])
  })

  test("the bootstrapped default canvas is saved immediately: drawer lists it, and a reload reopens it instead of creating a new one", async ({
    page,
  }) => {
    await gotoAndSettle(page)

    // Regression: `claimDefaultCanvas()` used to call `setActive()` only,
    // never `saveCanvas()`/`setLastOpenedId()` — so the top bar claimed
    // "Saved" while storage stayed empty.
    await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 3000 })

    await page.getByRole("button", { name: "Open menu" }).click()
    const dialog = page.getByRole("dialog", { name: "Canvases" })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText("No saved canvases yet.")).toHaveCount(0)
    await expect(dialog.getByText("Untitled canvas")).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()

    const lastOpenedIdBefore = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      LAST_OPENED_KEY,
    )
    expect(lastOpenedIdBefore).not.toBeNull()

    await page.reload()
    await expect(page.locator(".react-flow")).toBeVisible()
    await expect(page.getByText("Yasuo").first()).toBeVisible()

    const lastOpenedIdAfter = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      LAST_OPENED_KEY,
    )
    expect(lastOpenedIdAfter).toBe(lastOpenedIdBefore)

    const savedCanvasCount = await page.evaluate(
      (prefix) =>
        Array.from({ length: window.localStorage.length }, (_, i) =>
          window.localStorage.key(i),
        ).filter((key) => key?.startsWith(prefix) ?? false).length,
      CANVAS_KEY_PREFIX,
    )
    expect(savedCanvasCount).toBe(1)
  })

  test("opening the drawer focuses the search field, not the close button, and never shows its tooltip", async ({
    page,
  }) => {
    await gotoAndSettle(page)

    await page.getByRole("button", { name: "Open menu" }).click()
    await expect(page.getByRole("dialog", { name: "Canvases" })).toBeVisible()

    await expect(page.getByRole("textbox", { name: "Search canvases" })).toBeFocused()

    // Tooltips must only ever appear from hover or real keyboard
    // navigation (`:focus-visible`) — never from this drawer-open
    // effect's programmatic focus. Wait past Tooltip's 400ms open delay
    // to prove it never appears, not merely that it hasn't yet.
    await page.waitForTimeout(500)
    await expect(page.getByText("Close menu", { exact: true })).toHaveCount(0)
  })
})
