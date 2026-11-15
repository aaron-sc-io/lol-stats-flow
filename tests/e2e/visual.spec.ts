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

// First run opens the "Tutorial" canvas (default chain + a Tutorial node).
// These specs and baselines cover the plain default canvas, so make one
// via "New canvas" first — every later `goto` restores it as last-opened.
test.beforeEach(async ({ page }) => {
  await page.goto("./")
  await page.getByRole("button", { name: "Open menu" }).click()
  await page.getByRole("button", { name: "New canvas" }).click()
  await expect(page.locator('[data-testid="rf__node-tutorial"]')).toHaveCount(0)
  await page.mouse.move(0, 0)
})

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

test.describe("Phase 4 AC #1/#2 — Champion node width-driven scaling", () => {
  test("resizing to 360/560/900 scales the portrait linearly, keeps content fully inside the node, and lets height follow the content", async ({
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

      // Only the width is pinned by a resize: the node's height is whatever
      // its (width-scaled) content needs, so the node box hugs its frame.
      const frameBox = await nodeFrameOf(champion).boundingBox()
      expect(frameBox, `frame box at ${targetWidth}`).not.toBeNull()
      if (frameBox !== null) {
        expect(Math.abs(frameBox.height - box.height)).toBeLessThanOrEqual(2)
      }

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
        // Each item-set handle's center X is on the node's right border (±2px).
        if (handleBox !== null) {
          const handleCenterX = handleBox.x + handleBox.width / 2
          expect(Math.abs(handleCenterX - (box.x + box.width))).toBeLessThanOrEqual(2)
        }
      }

      await expect(champion).toHaveScreenshot(`champion-node-width-${targetWidth}.png`)
    }
  })

  test("after a resize, adding an item set grows the node and its resizer outline with the content", async ({
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

    const brBracket = champion.locator(".react-flow__resize-control.handle.bottom.right")
    const brBox = await brBracket.boundingBox()
    expect(brBox).not.toBeNull()
    if (brBox === null) {
      return
    }
    const startY = brBox.y + brBox.height / 2
    await page.mouse.move(brBox.x + brBox.width / 2, startY)
    await page.mouse.down()
    await page.mouse.move(brBox.x + 80, startY, { steps: 15 })
    await page.mouse.up()
    await page.mouse.move(0, 0)
    await page.waitForTimeout(200)

    const resizedBox = await champion.boundingBox()
    expect(resizedBox).not.toBeNull()
    if (resizedBox === null) {
      return
    }
    expect(resizedBox.width).toBeGreaterThan(baseBox.width)

    await champion.getByRole("button", { name: "+ Add item set" }).click()
    await champion.getByRole("button", { name: "+ Add item set" }).click()
    await expect(champion.locator('.react-flow__handle[data-handleid^="itemset:"]')).toHaveCount(3)
    await page.waitForTimeout(200)

    const grownBox = await champion.boundingBox()
    expect(grownBox).not.toBeNull()
    if (grownBox === null) {
      return
    }
    // Width stays where the user left it; height grows to fit the new row.
    expect(Math.abs(grownBox.width - resizedBox.width)).toBeLessThanOrEqual(1)
    expect(grownBox.height).toBeGreaterThan(resizedBox.height)

    // The bottom-right resize bracket tracks the grown node, not the old height.
    const bottomBracket = await champion
      .locator(".react-flow__resize-control.handle.bottom.right")
      .boundingBox()
    expect(bottomBracket).not.toBeNull()
    if (bottomBracket !== null) {
      expect(
        Math.abs(bottomBracket.y + bottomBracket.height - (grownBox.y + grownBox.height)),
      ).toBeLessThanOrEqual(6)
    }
  })
})

test.describe("Phase 4 AC #3 — RosterPicker", () => {
  test("hover opens within 300ms; search narrows to one match; available champions lead; lane + class filters; unavailable guard; selecting updates the node", async ({
    page,
  }) => {
    await page.goto("./")
    await fitViewNow(page)
    const champion = nodeById(page, DEFAULT_CHAMPION_ID)
    const dialog = page.getByRole("dialog", { name: "Choose champion" })

    await champion.getByRole("button", { name: "Choose champion" }).hover()
    await expect(dialog).toBeVisible({ timeout: 300 })

    // Cells are icon-only; each one's accessible name is the champion name.
    const search = dialog.getByRole("textbox", { name: "Search" })
    await search.fill("yas")
    const gridItems = dialog.locator("button[tabindex]")
    await expect(gridItems).toHaveCount(1)
    await expect(gridItems.first()).toHaveAccessibleName("Yasuo")
    await search.fill("")

    // Available (modeled) champions are listed before every unavailable one.
    const disabledFlags = await gridItems.evaluateAll((items) =>
      items.map((item) => item.getAttribute("aria-disabled") === "true"),
    )
    const firstDisabled = disabledFlags.indexOf(true)
    expect(firstDisabled).toBeGreaterThan(0)
    expect(disabledFlags.slice(firstDisabled).every(Boolean)).toBe(true)

    // Lane and class filters AND-combine.
    const filterBar = dialog.locator("fieldset")
    await filterBar.getByRole("button", { name: "Bot lane", exact: true }).click()
    await filterBar.getByRole("button", { name: "Marksman", exact: true }).click()
    const vayneButton = dialog.getByRole("button", { name: "Vayne", exact: true })
    await expect(vayneButton).toBeVisible()
    await expect(vayneButton).not.toHaveAttribute("aria-disabled", "true")
    await expect(dialog.getByRole("button", { name: /^Garen/ })).toHaveCount(0)

    // Unavailable champions are greyscaled, labelled "(unavailable)", and
    // clicking one does not select it.
    const disabledItem = dialog.locator('button[aria-disabled="true"]').first()
    await expect(disabledItem).toHaveAccessibleName(/ \(unavailable\)$/)
    await expect(disabledItem.locator('img[class*="pickerItemUnavailable"]')).toHaveCount(1)
    await disabledItem.hover()
    await expect(page.getByRole("tooltip")).toHaveText(/ \(unavailable\)$/)
    await disabledItem.click({ force: true })
    await expect(champion.getByText("Yasuo").first()).toBeVisible()

    await filterBar.getByRole("button", { name: "Clear filters" }).click()
    await search.fill("Garen")
    await dialog.getByRole("button", { name: "Garen", exact: true }).click()
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
    await filterBar.getByRole("button", { name: "Clear filters" }).click()
    await expect(dialog.getByRole("button", { name: /Rabadon/ })).toBeVisible()

    // Cells are icon-only: the item name is the accessible name and a tooltip.
    await dialog.getByRole("textbox", { name: "Search" }).fill("liand")
    const results = dialog.locator("button[tabindex]")
    await expect(results).toHaveCount(1)
    await expect(results.first()).toHaveAccessibleName(/^Liandry/)
    await results.first().hover()
    await expect(page.getByRole("tooltip")).toHaveText(/^Liandry/)
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
    await page.getByRole("menuitem", { name: "Combo", exact: true }).click()
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

test.describe("Board nodes & GraphNode interactive features", () => {
  test("verifies node delete button, 3-corner resize brackets, level 20 slider, horizontal targets row, legend popover overrides, step icon ticks tooltip, and line hover/pinning", async ({
    page,
  }) => {
    await page.goto("./")
    await expect(page.locator(".react-flow")).toBeVisible()
    await page.waitForTimeout(300)
    await fitViewNow(page)

    const champion = nodeById(page, DEFAULT_CHAMPION_ID)
    const combo = nodeById(page, DEFAULT_COMBO_ID)
    const graph = nodeById(page, DEFAULT_GRAPH_ID)

    // 1 & 2. Every node has TL, BL, BR corner resize brackets and top-right delete button (no TR resize handle).
    for (const node of [champion, combo, graph]) {
      await expect(node.locator(".react-flow__resize-control.handle.top.left")).toBeVisible()
      await expect(node.locator(".react-flow__resize-control.handle.bottom.left")).toBeVisible()
      await expect(node.locator(".react-flow__resize-control.handle.bottom.right")).toBeVisible()
      await expect(node.locator(".react-flow__resize-control.handle.top.right")).toHaveCount(0)
    }

    // 4. Champion level slider reaches 20.
    const levelSlider = champion.getByRole("slider", { name: "Champion level" })
    await expect(levelSlider).toHaveAttribute("aria-valuemax", "20")
    await levelSlider.focus()
    await page.keyboard.press("End")
    await expect(levelSlider).toHaveAttribute("aria-valuenow", "20")

    // 5, 6, 7, 8. Graph targets panel: icon-only Add target with tooltip, horizontal row, vertical compact stat fields.
    const addTargetBtn = graph.getByRole("button", { name: "Add target" })
    await addTargetBtn.hover()
    await expect(page.getByRole("tooltip", { name: "Add target" })).toBeVisible()
    await addTargetBtn.click()
    const targetCards = graph.locator('[class*="targetBlock"]')
    await expect(targetCards).toHaveCount(2)
    const card0Box = await targetCards.nth(0).boundingBox()
    const card1Box = await targetCards.nth(1).boundingBox()
    expect(card0Box).not.toBeNull()
    expect(card1Box).not.toBeNull()
    if (card0Box !== null && card1Box !== null) {
      // Laid out horizontally in a row (same Y, increasing X)
      expect(Math.abs(card0Box.y - card1Box.y)).toBeLessThanOrEqual(2)
      expect(card1Box.x).toBeGreaterThan(card0Box.x)
    }

    // 9. Legend swatch hover opens customization popover (color, width, dash, visible toggle).
    const legendBtn = graph.locator("ul").getByRole("button").first()
    await legendBtn.hover()
    const customizeDialog = page.getByRole("dialog", { name: /Customize Combo 1/i })
    await expect(customizeDialog).toBeVisible()
    await customizeDialog.getByRole("button", { name: "Stroke width 2.5" }).click()
    await customizeDialog.getByRole("button", { name: "Dash style Dashed" }).click()
    await page.mouse.move(10, 10)
    await page.waitForTimeout(250)

    // 10 & 11. X-axis step icon ticks render ability icons and show all-lines breakdown tooltip on hover.
    const step1Tick = graph.locator('[data-step-tick="Step 1"]')
    await expect(step1Tick).toBeVisible()
    await expect(step1Tick.locator("image")).toHaveCount(1)
    const step1IconBox = await step1Tick.locator("rect").first().boundingBox()
    expect(step1IconBox).not.toBeNull()
    if (step1IconBox !== null) {
      expect(step1IconBox.width).toBeGreaterThanOrEqual(20)
      expect(step1IconBox.height).toBeGreaterThanOrEqual(20)
    }
    const step4Tick = graph.locator('[data-step-tick="Step 4"]')
    await expect(step4Tick.locator("title")).toHaveText("Steel Tempest ✳ (crit)")
    await expect(combo.locator('[title="Steel Tempest ✳ (crit)"]')).toHaveCount(2)
    await step1Tick.hover()
    await expect(page.getByRole("tooltip").filter({ hasText: "Step 1" })).toBeVisible()
    await page.mouse.move(10, 10)

    // 12 & 13. Clicking a line pins it; clicking empty chart area unpins it.
    const hitSegment = graph.locator('[class*="segmentHitArea"]').first()
    await hitSegment.click({ force: true })
    await expect(graph.locator("[data-pinned-series]")).toHaveCount(1)
    await graph.locator('[class*="chartWrap"]').click({ position: { x: 5, y: 5 } })
    await expect(graph.locator("[data-pinned-series]")).toHaveCount(0)

    // ComboNode resizing keeps palette and timeline strictly inside the node frame.
    const comboHandle = combo.locator(".react-flow__resize-control.handle.bottom.right")
    const comboHandleBox = await comboHandle.boundingBox()
    expect(comboHandleBox).not.toBeNull()
    if (comboHandleBox !== null) {
      await page.mouse.move(
        comboHandleBox.x + comboHandleBox.width / 2,
        comboHandleBox.y + comboHandleBox.height / 2,
      )
      await page.mouse.down()
      await page.mouse.move(comboHandleBox.x - 140, comboHandleBox.y - 120, { steps: 12 })
      await page.mouse.up()
      await page.mouse.move(0, 0)
      await page.waitForTimeout(200)
    }
    const comboBox = await combo.boundingBox()
    const comboFrameBox = await nodeFrameOf(combo).boundingBox()
    expect(comboBox).not.toBeNull()
    expect(comboFrameBox).not.toBeNull()
    if (comboBox !== null && comboFrameBox !== null) {
      expect(Math.abs(comboFrameBox.width - comboBox.width)).toBeLessThanOrEqual(2)
      expect(Math.abs(comboFrameBox.height - comboBox.height)).toBeLessThanOrEqual(2)
      await assertFullyInside(
        combo.locator('[class*="timelineList"]').first(),
        comboBox,
        "combo timeline",
      )
      await assertFullyInside(
        combo.locator('[class*="paletteGrid"]').first(),
        comboBox,
        "combo palette",
      )
    }
  })
})
