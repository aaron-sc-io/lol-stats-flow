import { AxeBuilder } from "@axe-core/playwright"
import { expect, type Locator, type Page, test } from "@playwright/test"

// Known ids from `src/graph/default-canvas.ts` — anchoring selectors to
// these (instead of `.first()`/`.last()` DOM-order guesses) is required
// because React Flow re-parents a *selected* node to the end of the DOM
// (for stacking), so positional locators silently stop meaning "most
// recently added" the moment any earlier node gets selected.
const DEFAULT_CHAMPION_ID = "champion-yasuo"
const DEFAULT_COMBO_ID = "combo-1"
const DEFAULT_GRAPH_ID = "graph-1"

/** Manual pointer-drag (not `locator.dragTo`) so React Flow's connection
 * system sees real intermediate pointermove events, matching how its own
 * drag-threshold/collision detection actually behaves. Moving the mouse
 * away afterward (rather than leaving it parked on the drop target) gives
 * dnd-kit's PointerSensor a clean tick to settle its internal drag-end
 * state before the next interaction — without it, a click immediately
 * after a drag can be swallowed. */
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

/** The cascading "Add node" placement (see `AddNodeMenu.tsx`) keeps new
 * nodes from overlapping existing ones, but as the canvas grows, content
 * can still render partially outside the current viewport/zoom — which
 * makes coordinate-based drags land on the wrong element. Re-fitting
 * before every drag keeps every handle/row used below reliably on-screen. */
async function fitViewNow(page: Page) {
  await page.getByRole("button", { name: "Fit View" }).click()
  await page.waitForTimeout(200)
}

function nodeById(page: Page, nodeId: string) {
  return page.locator(`[data-testid="rf__node-${nodeId}"]`)
}
function championNodesExcept(page: Page, exceptId: string) {
  return page.locator(`[data-testid^="rf__node-champion-"]:not([data-id="${exceptId}"])`)
}
function comboNodesExcept(page: Page, exceptId: string) {
  return page.locator(`[data-testid^="rf__node-combo-"]:not([data-id="${exceptId}"])`)
}

async function addNode(page: Page, type: "Champion" | "Combo") {
  await page.getByRole("button", { name: "Add node" }).click()
  await page.getByRole("menuitem", { name: type, exact: true }).click()
  await fitViewNow(page)
}

test.describe("Phase 3 — graph model & nodes", () => {
  test("default canvas: axe clean, connect, add/reorder/delete steps, item change propagates, Brand + Liandry's, two combos, step/tick toggle", async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await page.goto("./")
    await expect(page.locator(".react-flow")).toBeVisible()
    await expect(page.getByText("Yasuo").first()).toBeVisible()
    // The initial fitView can run before fonts/content are fully measured,
    // leaving some node content clipped at the viewport edge.
    await page.waitForTimeout(300)
    await fitViewNow(page)

    await test.step("axe: 0 serious/critical violations on the default canvas", async () => {
      const results = await new AxeBuilder({ page }).analyze()
      const seriousOrCritical = results.violations.filter(
        (violation) => violation.impact === "serious" || violation.impact === "critical",
      )
      expect(seriousOrCritical).toEqual([])
    })

    const defaultChampion = nodeById(page, DEFAULT_CHAMPION_ID)
    const defaultCombo = nodeById(page, DEFAULT_COMBO_ID)
    const defaultGraph = nodeById(page, DEFAULT_GRAPH_ID)

    await test.step("add steps by clicking palette buttons (Yasuo R)", async () => {
      const stepsBefore = await defaultCombo.locator("li").count()
      await defaultCombo.getByTitle("Last Breath (R)").click()
      await expect(defaultCombo.locator("li")).toHaveCount(stepsBefore + 1)
    })

    await test.step("reorder a step via drag", async () => {
      const entries = defaultCombo.locator("li")
      const firstLabelBefore = await entries.first().innerText()
      const handle = entries.last().getByRole("button", { name: /Reorder step/ })
      const targetRow = entries.first()
      await dragBetween(page, handle, targetRow)
      const firstLabelAfter = await entries.first().innerText()
      expect(firstLabelAfter).not.toBe(firstLabelBefore)
    })

    await test.step("delete a step", async () => {
      const entries = defaultCombo.locator("li")
      const countBefore = await entries.count()
      await entries
        .first()
        .getByRole("button", { name: /Remove step/ })
        .click()
      await expect(entries).toHaveCount(countBefore - 1)
    })

    let totalBeforeItemChange = ""
    await test.step("change an item in the shop -> graph total changes with no further interaction", async () => {
      totalBeforeItemChange =
        (await defaultGraph.locator("table tbody tr td.num").first().innerText()) ?? ""

      const emptySlot = defaultChampion.getByLabel(/slot 2: choose item/).first()
      await emptySlot.hover()
      const dialog = page.getByRole("dialog", { name: /slot 2: choose item/ })
      await expect(dialog).toBeVisible()
      await dialog.getByRole("textbox", { name: "Search" }).fill("Black Cleaver")
      await dialog.getByRole("button", { name: /Black Cleaver/ }).click()

      await expect(async () => {
        const totalAfter = await defaultGraph.locator("table tbody tr td.num").first().innerText()
        expect(totalAfter).not.toBe(totalBeforeItemChange)
      }).toPass()
    })

    await test.step("connect a second champion (Brand, with Liandry's) into the same combo by dragging handles", async () => {
      await addNode(page, "Champion")
      const brandChampion = championNodesExcept(page, DEFAULT_CHAMPION_ID)
      await brandChampion.getByRole("button", { name: "Choose champion" }).hover()
      const roster = page.getByRole("dialog", { name: "Choose champion" })
      await expect(roster).toBeVisible()
      await roster.getByRole("textbox", { name: "Search" }).fill("Brand")
      await roster.getByRole("button", { name: /^Brand$/ }).click()

      await brandChampion.getByRole("button", { name: "+ Add item set" }).click()
      const brandSlot = brandChampion.getByLabel(/slot 1: choose item/).first()
      await brandSlot.hover()
      const itemDialog = page.getByRole("dialog", { name: /slot 1: choose item/ })
      await expect(itemDialog).toBeVisible()
      await itemDialog.getByRole("textbox", { name: "Search" }).fill("Liandry")
      await itemDialog.getByRole("button", { name: /Liandry/ }).click()

      await fitViewNow(page)
      const brandHandle = brandChampion
        .locator('.react-flow__handle[data-handleid^="itemset:"]')
        .first()
      const comboTargetHandle = defaultCombo.locator(".react-flow__handle-left")
      await dragBetween(page, brandHandle, comboTargetHandle)

      await expect(defaultCombo.getByRole("button", { name: /^Brand —/ })).toBeVisible()
    })

    await test.step("interleaved stepwise damage from both sources (Brand Q triggers Liandry's DoT)", async () => {
      await defaultCombo.getByTitle("Sear (Q)").click()
      const entries = defaultCombo.locator("li")
      await expect(entries.last().getByTitle("Sear (Q)")).toBeVisible()
      // Both a Yasuo-sourced and a Brand-sourced step icon exist in the timeline.
      await expect(
        entries.getByTitle(/Steel Tempest|Sweeping Blade|Auto Attack|Last Breath/).first(),
      ).toBeVisible()
      await expect(entries.getByTitle("Sear (Q)")).toHaveCount(1)
    })

    await test.step("two combos into one graph -> two series rendered", async () => {
      await addNode(page, "Combo")
      const secondCombo = comboNodesExcept(page, DEFAULT_COMBO_ID)
      const brandChampion = championNodesExcept(page, DEFAULT_CHAMPION_ID)
      const brandHandle = brandChampion
        .locator('.react-flow__handle[data-handleid^="itemset:"]')
        .first()
      await fitViewNow(page)
      await dragBetween(page, brandHandle, secondCombo.locator(".react-flow__handle-left"))
      await expect(secondCombo.getByTitle("Sear (Q)")).toBeVisible()
      await secondCombo.getByTitle("Sear (Q)").click()

      const secondComboOutHandle = secondCombo.locator(".react-flow__handle-right")
      await fitViewNow(page)
      await dragBetween(
        page,
        secondComboOutHandle,
        defaultGraph.locator(".react-flow__handle-left"),
      )

      await expect(defaultGraph.locator(".recharts-wrapper")).toBeVisible()
      // Scoped to the chart legend's own <ul> (Phase 4b) — the comparison
      // table's sortable "Combo" column header is also a <button> whose
      // text starts with "Combo", so an unscoped `getByRole("button")`
      // over the whole graph node would double-count it.
      await expect(
        defaultGraph
          .locator("ul")
          .getByRole("button")
          .filter({ hasText: /^Combo/ }),
      ).toHaveCount(2)
    })

    await test.step("Step <-> Tick toggle increases the rendered point count when DoTs are present", async () => {
      await defaultGraph.getByRole("radio", { name: "Cumulative" }).click()

      const dotCount = () =>
        defaultGraph.locator(
          ".recharts-line-dots circle, .recharts-line-dots rect, .recharts-line-dots polygon",
        )

      await expect(defaultGraph.getByRole("radio", { name: "Step", exact: true })).toHaveAttribute(
        "aria-checked",
        "true",
      )
      const stepPointCount = await dotCount().count()

      await defaultGraph.getByRole("radio", { name: "Tick", exact: true }).click()
      await expect(async () => {
        const tickPointCount = await dotCount().count()
        expect(tickPointCount).toBeGreaterThan(stepPointCount)
      }).toPass()
    })
  })
})
