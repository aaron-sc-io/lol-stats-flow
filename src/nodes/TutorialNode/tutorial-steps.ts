import type { FlowNode } from "@/graph/types"

export type TutorialStep = {
  readonly title: string
  readonly body: readonly string[]
  /** Node types the viewport frames when the user lands on this step
   * (always alongside the Tutorial node itself). Empty = whole canvas. */
  readonly focus: readonly FlowNode["type"][]
}

/** The walkthrough's pages, in order. Copy only — the node renders these
 * verbatim and the step index is the only thing stored. */
export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    title: "Welcome",
    body: [
      "This app is a League of Legends damage calculator built as a flow of nodes.",
      "Data flows left to right: Champion (with item sets) → Combo (a sequence of abilities) → Graph (damage against targets).",
      "Use Next to step through each part. The canvas will pan to whatever is being described.",
    ],
    focus: [],
  },
  {
    title: "Champion node",
    body: [
      "Click the portrait to choose a champion, and set their level with the level slider.",
      "Each row is an item set: click a slot to open the item shop, rename the set, or add more sets to compare builds side by side.",
    ],
    focus: ["champion"],
  },
  {
    title: "Connecting nodes",
    body: [
      "Every item set has its own output handle on the right edge of the Champion node.",
      "Drag from an item set's handle to a Combo's input to simulate the combo with that build. Connect several sets to compare them.",
      "Hovering a node highlights everything feeding it.",
    ],
    focus: ["champion", "combo"],
  },
  {
    title: "Combo node",
    body: [
      "Click abilities in the palette to append them to the timeline. Drag steps to reorder them, and remove ones you don't want.",
      "Click the combo name to rename it. The number in the header is the combo's total damage against the connected graph's first target.",
    ],
    focus: ["combo"],
  },
  {
    title: "Graph node",
    body: [
      "Connect a Combo's output to a Graph to plot its damage. Add targets with their own HP, armor and magic resist, or apply a preset.",
      "Switch between cumulative damage and target HP, and between per-step and per-second x axes. The table below compares every combo against every target.",
    ],
    focus: ["graph"],
  },
  {
    title: "Adding nodes",
    body: [
      "Use the + button in the top bar to add more Champions, Combos, or Graphs — including the Effective Damage graph, which sweeps armor or magic resist.",
      "Select a node to duplicate or delete it. Ctrl+Z / Ctrl+Shift+Z undo and redo any change.",
    ],
    focus: [],
  },
  {
    title: "Saving and sharing",
    body: [
      "Everything autosaves. Rename this canvas in the top bar.",
      "The menu button opens your canvases: create, open, duplicate or delete them, import or export JSON, and copy a share link.",
    ],
    focus: [],
  },
  {
    title: "You're ready",
    body: [
      "Experiment with this canvas, or start a fresh one from the menu.",
      "Delete this node whenever you're done. You can reopen the tutorial any time from the menu.",
    ],
    focus: [],
  },
]
