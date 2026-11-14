import path from "node:path"
import { AxeBuilder } from "@axe-core/playwright"
import { expect, type Locator, type Page, test } from "@playwright/test"
import { findTokenViolations } from "../../scripts/lint-tokens"

// Known ids from `src/graph/default-canvas.ts` (see `tests/e2e/phase3.spec.ts`
// for why these are used instead of DOM-order locators).
const DEFAULT_CHAMPION_ID = "champion-yasuo"
const DEFAULT_COMBO_ID = "combo-1"
const DEFAULT_GRAPH_ID = "graph-1"
const CHAMPION_COMBO_EDGE_ID = "edge-champion-combo"
const COMBO_GRAPH_EDGE_ID = "edge-combo-graph"

function nodeById(page: Page, nodeId: string): Locator {
  return page.locator(`[data-testid="rf__node-${nodeId}"]`)
}

function edgePathById(page: Page, edgeId: string): Locator {
  return page.locator(`[data-testid="rf__edge-${edgeId}"] path`)
}

/** `data-highlighted`/`data-dimmed`/`data-selected` are set on `NodeFrame`'s
 * own root element (see `NodeFrame.tsx`), which is a *descendant* of React
 * Flow's node wrapper (`[data-testid="rf__node-<id>"]`) — the wrapper
 * itself never carries these attributes. `[class*="frame"]` matches
 * `NodeFrame.module.css`'s scoped `.frame` class regardless of its CSS
 * Modules hash suffix. */
function nodeFrameOf(node: Locator): Locator {
  return node.locator('[class*="frame"]').first()
}

async function fitViewNow(page: Page) {
  await page.getByRole("button", { name: "Fit View" }).click()
  await page.waitForTimeout(200)
}

/** Manual pointer-drag so React Flow's connection system sees real
 * intermediate pointermove events — see `phase3.spec.ts` for the full
 * rationale (same helper, duplicated rather than imported: every e2e spec
 * file in this repo owns its local setup helpers). */
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

type Box = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

async function assertFullyInside(locator: Locator, parent: Box, label: string) {
  const box = await locator.boundingBox()
  expect(box, `${label}: expected a visible bounding box`).not.toBeNull()
  if (box === null) {
    return
  }
  const epsilon = 1
  expect(box.x, `${label}.x`).toBeGreaterThanOrEqual(parent.x - epsilon)
  expect(box.y, `${label}.y`).toBeGreaterThanOrEqual(parent.y - epsilon)
  expect(box.x + box.width, `${label}.right`).toBeLessThanOrEqual(parent.x + parent.width + epsilon)
  expect(box.y + box.height, `${label}.bottom`).toBeLessThanOrEqual(
    parent.y + parent.height + epsilon,
  )
}

test.describe("token lint", () => {
  test("no raw colors or px font-sizes outside tokens.css", () => {
    const violations = findTokenViolations(path.join(process.cwd(), "src"))
    expect(violations).toEqual([])
  })
})

test.describe("Phase 4 AC #1/#2 — Champion node aspect-locked scaling", () => {
  test("resizing to 360/560/900 preserves aspect ratio, keeps content fully inside the node, and scales the portrait linearly", async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await page.goto("./")
    await expect(page.locator(".react-flow")).toBeVisible()
    await page.waitForTimeout(300)
    await fitViewNow(page)

    const champion = nodeById(page, DEFAULT_CHAMPION_ID)
    await champion.click()
    await page.waitForTimeout(150)

    const baseBox = await champion.boundingBox()
    expect(baseBox).not.toBeNull()
    if (baseBox === null) {
      return
    }
    const baseRatio = baseBox.height / baseBox.width
    const basePortraitBox = await champion.locator("img").first().boundingBox()
    expect(basePortraitBox).not.toBeNull()
    const basePortraitRatio = (basePortraitBox?.width ?? 0) / baseBox.width

    async function dragResizeTo(targetWidth: number) {
      const handle = champion.locator(".react-flow__resize-control.handle.bottom.right")
      const handleBox = await handle.boundingBox()
      const nodeBox = await champion.boundingBox()
      expect(handleBox).not.toBeNull()
      expect(nodeBox).not.toBeNull()
      if (handleBox === null || nodeBox === null) {
        return
      }
      const targetHeight = targetWidth * baseRatio
      await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
      await page.mouse.down()
      await page.mouse.move(nodeBox.x + targetWidth, nodeBox.y + targetHeight, { steps: 15 })
      await page.mouse.up()
      await page.mouse.move(0, 0)
      await page.waitForTimeout(200)
    }

    for (const targetWidth of [360, 560, 900] as const) {
      await dragResizeTo(targetWidth)

      const box = await champion.boundingBox()
      expect(box, `node box at target width ${targetWidth}`).not.toBeNull()
      if (box === null) {
        continue
      }

      // Aspect ratio stays within ±1% of the base ratio.
      const actualRatio = box.height / box.width
      expect(Math.abs(actualRatio - baseRatio) / baseRatio).toBeLessThanOrEqual(0.01)

      // Portrait width scales linearly with node width (±2%).
      const portraitBox = await champion.locator("img").first().boundingBox()
      expect(portraitBox, `portrait box at ${targetWidth}`).not.toBeNull()
      if (portraitBox !== null) {
        const portraitRatio = portraitBox.width / box.width
        expect(Math.abs(portraitRatio - basePortraitRatio) / basePortraitRatio).toBeLessThanOrEqual(
          0.02,
        )
        await assertFullyInside(champion.locator("img").first(), box, "portrait")
      }

      // Every slot, the level slider, and the item-set handle stay fully inside the node box.
      await assertFullyInside(
        champion.getByRole("slider", { name: "Champion level" }),
        box,
        "level slider",
      )
      const slotCount = await champion
        .locator('[class*="emptySlot"], [class*="filledSlot"]')
        .count()
      for (let index = 0; index < slotCount; index += 1) {
        await assertFullyInside(
          champion.locator('[class*="emptySlot"], [class*="filledSlot"]').nth(index),
          box,
          `slot ${index}`,
        )
      }

      // Each item-set handle's center Y is within ±2px of its row's center Y.
      const handles = champion.locator('.react-flow__handle[data-handleid^="itemset:"]')
      const handleCount = await handles.count()
      for (let index = 0; index < handleCount; index += 1) {
        const handle = handles.nth(index)
        const handleBox = await handle.boundingBox()
        const row = handle.locator("xpath=..")
        const rowBox = await row.boundingBox()
        expect(handleBox, `handle ${index} box`).not.toBeNull()
        expect(rowBox, `row ${index} box`).not.toBeNull()
        if (handleBox !== null && rowBox !== null) {
          const handleCenterY = handleBox.y + handleBox.height / 2
          const rowCenterY = rowBox.y + rowBox.height / 2
          expect(Math.abs(handleCenterY - rowCenterY)).toBeLessThanOrEqual(2)
        }
        await assertFullyInside(handle, box, `handle ${index}`)
      }

      await expect(champion).toHaveScreenshot(`champion-node-width-${targetWidth}.png`)
    }
  })

  test("dragging the resizer horizontally only still yields the base aspect ratio (±1%)", async ({
    page,
  }) => {
    await page.goto("./")
    await expect(page.locator(".react-flow")).toBeVisible()
    await page.waitForTimeout(300)
    await fitViewNow(page)

    const champion = nodeById(page, DEFAULT_CHAMPION_ID)
    await champion.click()
    await page.waitForTimeout(150)

    const baseBox = await champion.boundingBox()
    expect(baseBox).not.toBeNull()
    if (baseBox === null) {
      return
    }
    const baseRatio = baseBox.height / baseBox.width

    const rightLine = champion.locator(".react-flow__resize-control.line.right")
    const lineBox = await rightLine.boundingBox()
    expect(lineBox).not.toBeNull()
    if (lineBox === null) {
      return
    }
    // Drag purely horizontally — the Y coordinate never changes.
    const startY = lineBox.y + lineBox.height / 2
    await page.mouse.move(lineBox.x + lineBox.width / 2, startY)
    await page.mouse.down()
    await page.mouse.move(baseBox.x + 300, startY, { steps: 15 })
    await page.mouse.up()
    await page.mouse.move(0, 0)
    await page.waitForTimeout(200)

    const resizedBox = await champion.boundingBox()
    expect(resizedBox).not.toBeNull()
    if (resizedBox !== null) {
      expect(resizedBox.width).not.toBeCloseTo(baseBox.width, 0)
      const actualRatio = resizedBox.height / resizedBox.width
      expect(Math.abs(actualRatio - baseRatio) / baseRatio).toBeLessThanOrEqual(0.01)
    }
  })
})

test.describe("Phase 4 AC #3 — RosterPicker", () => {
  test("hover opens within 300ms; search narrows to one match; role filter + unmodeled guard; selecting updates the node", async ({
    page,
  }) => {
    await page.goto("./")
    await fitViewNow(page)
    const champion = nodeById(page, DEFAULT_CHAMPION_ID)
    const dialog = page.getByRole("dialog", { name: "Choose champion" })

    await champion.getByRole("button", { name: "Choose champion" }).hover()
    await expect(dialog).toBeVisible({ timeout: 300 })

    await dialog.getByRole("textbox", { name: "Search" }).fill("yas")
    const gridItems = dialog.locator("button[tabindex]")
    await expect(gridItems).toHaveCount(1)
    await expect(gridItems.first()).toContainText("Yasuo")

    await dialog.getByRole("textbox", { name: "Search" }).fill("")
    await dialog.getByRole("button", { name: "Marksman / ADC" }).click()
    const vayneButton = dialog.getByRole("button", { name: /Vayne/ })
    await expect(vayneButton).toBeVisible()
    await expect(vayneButton).not.toHaveAttribute("aria-disabled", "true")

    const filteredCount = await gridItems.count()
    let sawDisabled = false
    for (let index = 0; index < filteredCount; index += 1) {
      const item = gridItems.nth(index)
      if ((await item.getAttribute("aria-disabled")) === "true") {
        sawDisabled = true
        await expect(item).toContainText("Not modeled")
      }
    }
    expect(sawDisabled).toBe(true)

    const disabledItem = gridItems.filter({ hasText: "Not modeled" }).first()
    await disabledItem.click({ force: true })
    await expect(champion.getByText("Yasuo").first()).toBeVisible()

    await dialog.getByRole("button", { name: "Marksman / ADC" }).click()
    await dialog.getByRole("textbox", { name: "Search" }).fill("Garen")
    await dialog.getByRole("button", { name: /^Garen$/ }).click()
    await expect(champion.getByText("Garen").first()).toBeVisible()
  })
})

test.describe("Phase 4 AC #4 — ItemShop", () => {
  test("stat filter tooltips, filtering, search, and selecting an item update the slot and the graph total", async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await page.goto("./")
    await fitViewNow(page)
    const champion = nodeById(page, DEFAULT_CHAMPION_ID)
    const graph = nodeById(page, DEFAULT_GRAPH_ID)

    const totalBefore = await graph.locator("table tbody tr td.num").first().innerText()

    const slot = champion.getByLabel(/slot 2: choose item/).first()
    await slot.hover()
    const dialog = page.getByRole("dialog", { name: /slot 2: choose item/ })
    await expect(dialog).toBeVisible()

    const STAT_LABELS = [
      "Attack Damage",
      "Attack Speed",
      "Critical Strike",
      "Lethality / Armor Pen",
      "Ability Power",
      "Magic Penetration",
      "Health",
      "Armor",
      "Magic Resist",
      "Ability Haste",
      "Move Speed",
      "Lifesteal / Omnivamp",
    ]
    const filterBar = dialog.locator("fieldset")
    for (const label of STAT_LABELS) {
      await filterBar.getByRole("button", { name: label, exact: true }).hover()
      await expect(page.getByRole("tooltip", { name: label })).toBeVisible()
    }

    await filterBar.getByRole("button", { name: "Critical Strike" }).click()
    await expect(dialog.getByRole("button", { name: /Infinity Edge/ })).toBeVisible()
    await expect(dialog.getByRole("button", { name: /Rabadon/ })).toHaveCount(0)
    await filterBar.getByRole("button", { name: "Critical Strike" }).click()

    await dialog.getByRole("textbox", { name: "Search" }).fill("liand")
    const results = dialog.locator("button[tabindex]")
    await expect(results).toHaveCount(1)
    await expect(results.first()).toContainText("Liandry")
    await results.first().click()

    await expect(slot).toBeHidden()
    const filledSlot = champion.getByRole("button", { name: /Remove Liandry/ })
    await expect(filledSlot).toBeVisible()

    await expect(async () => {
      const totalAfter = await graph.locator("table tbody tr td.num").first().innerText()
      expect(totalAfter).not.toBe(totalBefore)
    }).toPass()
  })
})

test.describe("Phase 4 AC #5 — Upstream highlight", () => {
  test("hovering a combo's legend entry highlights its full upstream path and dims the other combo; mouse leave clears it", async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await page.goto("./")
    await fitViewNow(page)

    const champion = nodeById(page, DEFAULT_CHAMPION_ID)
    const comboA = nodeById(page, DEFAULT_COMBO_ID)
    const graph = nodeById(page, DEFAULT_GRAPH_ID)

    await comboA.getByRole("button", { name: "Steel Tempest (Q)", exact: true }).click()

    await page.getByRole("button", { name: "Add node" }).click()
    await page.getByRole("menuitem", { name: "Combo" }).click()
    await fitViewNow(page)
    const comboB = page.locator(
      `[data-testid^="rf__node-combo-"]:not([data-id="${DEFAULT_COMBO_ID}"])`,
    )
    const championHandle = champion
      .locator('.react-flow__handle[data-handleid^="itemset:"]')
      .first()
    await dragBetween(page, championHandle, comboB.locator(".react-flow__handle-left"))
    await expect(
      comboB.getByRole("button", { name: "Steel Tempest (Q)", exact: true }),
    ).toBeVisible()
    await comboB.getByRole("button", { name: "Steel Tempest (Q)", exact: true }).click()

    await fitViewNow(page)
    await dragBetween(
      page,
      comboB.locator(".react-flow__handle-right"),
      graph.locator(".react-flow__handle-left"),
    )
    const legend = graph.locator("ul")
    await expect(legend.getByRole("button").filter({ hasText: /^Combo/ })).toHaveCount(2)

    // Hover combo A's legend entry.
    await legend.getByRole("button", { name: /Combo 1/ }).hover()

    await expect(nodeFrameOf(comboA)).toHaveAttribute("data-highlighted", "true")
    await expect(nodeFrameOf(champion)).toHaveAttribute("data-highlighted", "true")
    await expect(nodeFrameOf(comboB)).not.toHaveAttribute("data-highlighted", "true")
    await expect(edgePathById(page, CHAMPION_COMBO_EDGE_ID)).toHaveAttribute(
      "data-highlighted",
      "true",
    )
    await expect(edgePathById(page, COMBO_GRAPH_EDGE_ID)).toHaveAttribute(
      "data-highlighted",
      "true",
    )

    const legendItemA = legend.getByRole("button", { name: /Combo 1/ })
    await expect(legendItemA).not.toHaveAttribute("data-dimmed", "true")
    const legendItemB = legend
      .getByRole("button")
      .filter({ hasText: /^Combo/ })
      .last()
    await expect(legendItemB).toHaveAttribute("data-dimmed", "true")

    // Mouse leave clears every highlight.
    await page.mouse.move(10, 10)
    await page.waitForTimeout(150)
    await expect(nodeFrameOf(comboA)).not.toHaveAttribute("data-highlighted", "true")
    await expect(nodeFrameOf(comboB)).not.toHaveAttribute("data-highlighted", "true")
    await expect(nodeFrameOf(champion)).not.toHaveAttribute("data-highlighted", "true")
  })
})

test.describe("Phase 4 — axe accessibility", () => {
  test("0 serious/critical violations with RosterPicker and ItemShop open", async ({ page }) => {
    await page.goto("./")
    await fitViewNow(page)
    const champion = nodeById(page, DEFAULT_CHAMPION_ID)

    await champion.getByRole("button", { name: "Choose champion" }).hover()
    await expect(page.getByRole("dialog", { name: "Choose champion" })).toBeVisible()
    const rosterResults = await new AxeBuilder({ page }).analyze()
    const rosterSeriousOrCritical = rosterResults.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    )
    expect(rosterSeriousOrCritical).toEqual([])
    await page.keyboard.press("Escape")

    const slot = champion.getByLabel(/slot 2: choose item/).first()
    await slot.hover()
    await expect(page.getByRole("dialog", { name: /slot 2: choose item/ })).toBeVisible()
    const itemResults = await new AxeBuilder({ page }).analyze()
    const itemSeriousOrCritical = itemResults.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    )
    expect(itemSeriousOrCritical).toEqual([])
  })
})

test.describe("Phase 4 AC #6 — screenshot baselines (100% DPR)", () => {
  test("full default canvas", async ({ page }) => {
    await page.goto("./")
    await expect(page.locator(".react-flow")).toBeVisible()
    await page.waitForTimeout(300)
    await fitViewNow(page)
    await expect(page).toHaveScreenshot("default-canvas.png", { fullPage: true })
  })

  test("open RosterPicker", async ({ page }) => {
    await page.goto("./")
    await fitViewNow(page)
    const champion = nodeById(page, DEFAULT_CHAMPION_ID)
    await champion.getByRole("button", { name: "Choose champion" }).hover()
    const dialog = page.getByRole("dialog", { name: "Choose champion" })
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveScreenshot("roster-picker-open.png")
  })

  test("open ItemShop", async ({ page }) => {
    await page.goto("./")
    await fitViewNow(page)
    const champion = nodeById(page, DEFAULT_CHAMPION_ID)
    const slot = champion.getByLabel(/slot 2: choose item/).first()
    await slot.hover()
    const dialog = page.getByRole("dialog", { name: /slot 2: choose item/ })
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveScreenshot("item-shop-open.png")
  })
})

test.describe("Phase 4 AC #6 — screenshot baselines (200% DPR)", () => {
  test.use({ deviceScaleFactor: 2 })

  test("full default canvas @2x", async ({ page }) => {
    await page.goto("./")
    await expect(page.locator(".react-flow")).toBeVisible()
    await page.waitForTimeout(300)
    await fitViewNow(page)
    await expect(page).toHaveScreenshot("default-canvas@2x.png", { fullPage: true })
  })

  test("open RosterPicker @2x", async ({ page }) => {
    await page.goto("./")
    await fitViewNow(page)
    const champion = nodeById(page, DEFAULT_CHAMPION_ID)
    await champion.getByRole("button", { name: "Choose champion" }).hover()
    const dialog = page.getByRole("dialog", { name: "Choose champion" })
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveScreenshot("roster-picker-open@2x.png")
  })

  test("open ItemShop @2x", async ({ page }) => {
    await page.goto("./")
    await fitViewNow(page)
    const champion = nodeById(page, DEFAULT_CHAMPION_ID)
    const slot = champion.getByLabel(/slot 2: choose item/).first()
    await slot.hover()
    const dialog = page.getByRole("dialog", { name: /slot 2: choose item/ })
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveScreenshot("item-shop-open@2x.png")
  })
})
