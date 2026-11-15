import type { NodeProps } from "@xyflow/react"
import { useInternalNode, useReactFlow } from "@xyflow/react"
import { Button } from "@/components/Button"
import { NodeFrame } from "@/components/NodeFrame"
import { useGraphStore } from "@/graph/store"
import type { TutorialFlowNode } from "@/graph/types"
import { cx } from "@/lib/cx"
import styles from "./TutorialNode.module.css"
import { TUTORIAL_STEPS } from "./tutorial-steps"

const DEFAULT_WIDTH = 380
const MIN_WIDTH = 300
const MAX_WIDTH = 640

/**
 * Step-by-step walkthrough of the app, only present on the "Tutorial"
 * canvas (`createTutorialCanvas`) — never offered in the Add Node menu.
 * Back/Next move through `TUTORIAL_STEPS` and pan the viewport to the
 * nodes each step describes.
 */
export function TutorialNode({ id, data, selected }: NodeProps<TutorialFlowNode>) {
  const setTutorialStep = useGraphStore((s) => s.setTutorialStep)
  const removeNode = useGraphStore((s) => s.removeNode)
  const internalNode = useInternalNode<TutorialFlowNode>(id)
  const nodeWidth = internalNode?.width ?? DEFAULT_WIDTH
  const { fitView } = useReactFlow()

  const lastIndex = TUTORIAL_STEPS.length - 1
  const index = Math.min(data.step, lastIndex)
  const step = TUTORIAL_STEPS[index]

  function goTo(next: number) {
    const target = TUTORIAL_STEPS[next]
    if (target === undefined) {
      return
    }
    setTutorialStep(id, next)
    const focusIds = useGraphStore
      .getState()
      .nodes.filter((node) => target.focus.includes(node.type))
      .map((node) => ({ id: node.id }))
    fitView({
      duration: 300,
      padding: 0.15,
      ...(focusIds.length === 0 ? {} : { nodes: [{ id }, ...focusIds] }),
    })
  }

  if (step === undefined) {
    return null
  }

  return (
    <NodeFrame
      label="Tutorial"
      title={step.title}
      selected={selected}
      width={nodeWidth}
      onDelete={() => removeNode(id)}
      deleteLabel="Delete tutorial node"
      resize={{ minWidth: MIN_WIDTH, maxWidth: MAX_WIDTH }}
      actions={
        <span className={cx(styles.progress, "num")}>
          {index + 1} / {TUTORIAL_STEPS.length}
        </span>
      }
    >
      <section className={styles.body} aria-label="Tutorial" aria-live="polite">
        <div className={styles.text}>
          {step.body.map((paragraph) => (
            <p key={paragraph} className={styles.paragraph}>
              {paragraph}
            </p>
          ))}
        </div>
        <ol className={styles.dots} aria-label="Tutorial steps">
          {TUTORIAL_STEPS.map((entry, entryIndex) => (
            <li key={entry.title}>
              <button
                type="button"
                className={cx(styles.dot, "nodrag")}
                data-active={entryIndex === index ? "true" : undefined}
                aria-label={`Step ${entryIndex + 1}: ${entry.title}`}
                aria-current={entryIndex === index ? "step" : undefined}
                onClick={() => goTo(entryIndex)}
              />
            </li>
          ))}
        </ol>
        <div className={cx(styles.controls, "nodrag")}>
          <Button variant="ghost" disabled={index === 0} onClick={() => goTo(index - 1)}>
            Back
          </Button>
          {index === lastIndex ? (
            <Button variant="secondary" onClick={() => goTo(0)}>
              Restart
            </Button>
          ) : (
            <Button variant="primary" onClick={() => goTo(index + 1)}>
              Next
            </Button>
          )}
        </div>
      </section>
    </NodeFrame>
  )
}
