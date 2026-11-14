import { describe, expect, it } from "vitest"
import type { ComboAction } from "@/engine"
import { groupComboActions } from "./action-grouping"

function action(id: string, slot: ComboAction["slot"], keyLabel: string): ComboAction {
  return {
    id,
    label: id,
    keyLabel,
    slot,
    damageType: "physical",
    modeled: true,
    castTimeMs: 250,
    rank: 1,
    forceCrit: false,
    components: [],
  }
}

describe("groupComboActions", () => {
  it("collapses a base ability and its stack variants into one StackActionGroup", () => {
    // Given Yasuo-shaped E actions: base + 4 stored-stack variants
    const actions = [
      action("E", "E", "E"),
      action("E-stack1", "E", "E1"),
      action("E-stack2", "E", "E2"),
      action("E-stack3", "E", "E3"),
      action("E-stack4", "E", "E4"),
    ]

    // When grouping
    const groups = groupComboActions(actions)

    // Then there is exactly one stack group with all 4 variants, sorted ascending
    expect(groups).toHaveLength(1)
    const group = groups[0]
    expect(group?.kind).toBe("stack")
    if (group?.kind === "stack") {
      expect(group.base.id).toBe("E")
      expect(group.variants.map((v) => v.id)).toEqual([
        "E-stack1",
        "E-stack2",
        "E-stack3",
        "E-stack4",
      ])
    }
  })

  it("keeps a crit/empowered variant as its own single group, separate from its base", () => {
    // Given Yasuo-shaped Q actions: base + guaranteed-crit variant
    const actions = [action("Q", "Q", "Q"), action("Q-empowered", "Q", "Q✳")]

    // When grouping
    const groups = groupComboActions(actions)

    // Then both render as independent single buttons (no stack merge)
    expect(groups).toEqual([
      { kind: "single", action: actions[0] },
      { kind: "single", action: actions[1] },
    ])
  })

  it("renders two same-slot actions with unrelated ids as independent singles (Darius Q-blade/Q-handle)", () => {
    const actions = [action("Q-blade", "Q", "Q"), action("Q-handle", "Q", "Q")]
    const groups = groupComboActions(actions)
    expect(groups).toEqual([
      { kind: "single", action: actions[0] },
      { kind: "single", action: actions[1] },
    ])
  })

  it("renders AA and AA-crit as independent singles", () => {
    const actions = [action("AA", "AA", "AA"), action("AA-crit", "AA", "AA✳")]
    const groups = groupComboActions(actions)
    expect(groups.every((g) => g.kind === "single")).toBe(true)
  })

  it("falls back to a single group for an orphaned stack-suffixed id with no base action present", () => {
    const actions = [action("X-stack1", "ITEM", "X1")]
    const groups = groupComboActions(actions)
    expect(groups).toEqual([{ kind: "single", action: actions[0] }])
  })
})
