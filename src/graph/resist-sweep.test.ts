import { describe, expect, it } from "vitest"
import { bonusShare, targetAtResist } from "./resist-sweep"

const tank = {
  id: "t",
  name: "Tank",
  maxHp: 4000,
  bonusHp: 0,
  armor: 200,
  bonusArmor: 150,
  magicResist: 80,
  bonusMagicResist: 20,
}

describe("targetAtResist", () => {
  it("keeps the target's bonus share of the swept resistance and leaves the other one alone", () => {
    expect(bonusShare(tank, "armor")).toBeCloseTo(0.75)
    expect(targetAtResist(tank, "armor", 100)).toMatchObject({
      armor: 100,
      bonusArmor: 75,
      magicResist: 80,
      bonusMagicResist: 20,
    })
    expect(targetAtResist(tank, "magicResist", 40)).toMatchObject({
      armor: 200,
      bonusArmor: 150,
      magicResist: 40,
      bonusMagicResist: 10,
    })
  })

  it("treats a target with no resistance as having no bonus share", () => {
    expect(bonusShare({ ...tank, armor: 0 }, "armor")).toBe(0)
  })
})
