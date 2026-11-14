import type { ActionSlot, ComboAction } from "@/engine"

/** One palette entry for a slot that has no stack-variant siblings — render
 * its own button directly (covers base casts, AA/AA-crit, crit/"empowered"
 * variants like Yasuo's `Q-empowered` or Garen's `E-crit`, and Darius's
 * `Q-blade`/`Q-handle` pair). */
export type SingleActionGroup = {
  readonly kind: "single"
  readonly action: ComboAction
}

/** A base ability plus its stored-stack variants (Yasuo's `E`/`E-stack1..4`),
 * collapsed into one stepper + add control per plan D9 ("E0-E4 style
 * collapsed into one entry") instead of N separate buttons. `variants` is
 * sorted ascending by stack count; `maxStacks` is `variants.length`. */
export type StackActionGroup = {
  readonly kind: "stack"
  readonly slot: ActionSlot
  readonly base: ComboAction
  readonly variants: readonly ComboAction[]
}

export type ActionGroup = SingleActionGroup | StackActionGroup

const STACK_ID_PATTERN = /^(.+)-stack(\d+)$/

/** Groups a Kit's `ComboAction[]` for the ability palette: actions whose id
 * matches `<baseId>-stackN` are merged with their `<baseId>` sibling into a
 * single `StackActionGroup`; everything else (including crit/empowered
 * variants, which stay independently clickable per plan D9's "separate
 * quick-add for crit variants") renders as its own `SingleActionGroup`.
 * Auto-attack groups (AA, AA-crit) lead the list; otherwise order is
 * preserved — a stack group takes the position of its base action. */
export function groupComboActions(actions: readonly ComboAction[]): ActionGroup[] {
  const byId = new Map(actions.map((action) => [action.id, action]))
  const stackVariantsByBaseId = new Map<string, ComboAction[]>()
  const consumedIds = new Set<string>()

  for (const action of actions) {
    const match = STACK_ID_PATTERN.exec(action.id)
    const baseId = match?.[1]
    if (baseId === undefined || !byId.has(baseId)) {
      continue
    }
    const variants = stackVariantsByBaseId.get(baseId) ?? []
    variants.push(action)
    stackVariantsByBaseId.set(baseId, variants)
    consumedIds.add(action.id)
  }

  const groups: ActionGroup[] = []
  for (const action of actions) {
    if (consumedIds.has(action.id)) {
      continue
    }
    const variants = stackVariantsByBaseId.get(action.id)
    if (variants !== undefined) {
      groups.push({
        kind: "stack",
        slot: action.slot,
        base: action,
        variants: [...variants].sort(stackCountOf),
      })
    } else {
      groups.push({ kind: "single", action })
    }
  }
  return [...groups.filter(isAutoAttackGroup), ...groups.filter((g) => !isAutoAttackGroup(g))]
}

function isAutoAttackGroup(group: ActionGroup): boolean {
  return (group.kind === "single" ? group.action.slot : group.slot) === "AA"
}

function stackCountOf(a: ComboAction, b: ComboAction): number {
  const countA = Number(STACK_ID_PATTERN.exec(a.id)?.[2] ?? 0)
  const countB = Number(STACK_ID_PATTERN.exec(b.id)?.[2] ?? 0)
  return countA - countB
}
