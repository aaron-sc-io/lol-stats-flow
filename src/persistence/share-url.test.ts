import { compressToEncodedURIComponent } from "lz-string"
import { describe, expect, it } from "vitest"
import { createDefaultCanvas } from "@/graph/default-canvas"
import { buildCanvasDocument } from "./document"
import { decodeShareHash, encodeShareUrl } from "./share-url"

const CURRENT_PATCH = "16.22.1"

function aDocument() {
  const { nodes, edges } = createDefaultCanvas()
  return buildCanvasDocument(
    {
      id: "canvas-original",
      name: "My scenario",
      patch: CURRENT_PATCH,
      createdAt: "2026-11-14T00:00:00.000Z",
      updatedAt: "2026-11-14T00:05:00.000Z",
    },
    nodes,
    edges,
  )
}

describe("encodeShareUrl / decodeShareHash", () => {
  it("round-trips name/patch/graph, but mints a fresh id and timestamps", () => {
    const original = aDocument()
    const url = encodeShareUrl(
      original,
      "https://aaron-sc-io.github.io/lol-stats-flow/?view=gallery",
    )
    const hash = new URL(url).hash

    const result = decodeShareHash(hash, CURRENT_PATCH)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.name).toBe(original.name)
    expect(result.value.patch).toBe(original.patch)
    expect(result.value.graph).toEqual(original.graph)
    expect(result.value.id).not.toBe(original.id)
    expect(result.value.createdAt).not.toBe(original.createdAt)
  })

  it("strips any existing hash/query from the link", () => {
    const url = encodeShareUrl(
      aDocument(),
      "https://aaron-sc-io.github.io/lol-stats-flow/?view=gallery#old",
    )

    expect(url).not.toContain("view=gallery")
    expect(url).not.toContain("#old")
    expect(url).toMatch(/^https:\/\/aaron-sc-io\.github\.io\/lol-stats-flow\/#c=/)
  })

  it("rejects a hash with no #c= payload", () => {
    const result = decodeShareHash("#view=gallery", CURRENT_PATCH)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe("empty")
  })

  it("rejects an empty #c= payload", () => {
    const result = decodeShareHash("#c=", CURRENT_PATCH)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe("empty")
  })

  it("rejects garbage that isn't valid lz-string compression", () => {
    const result = decodeShareHash("#c=***not-lzstring***", CURRENT_PATCH)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(["decompress-failed", "invalid-json"]).toContain(result.error.kind)
  })

  it("rejects valid compression wrapping non-JSON text", () => {
    const hash = `#c=${compressToEncodedURIComponent("this is not json")}`

    const result = decodeShareHash(hash, CURRENT_PATCH)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe("invalid-json")
  })

  it("rejects valid JSON that doesn't match the canvas schema", () => {
    const hash = `#c=${compressToEncodedURIComponent(JSON.stringify({ foo: "bar" }))}`

    const result = decodeShareHash(hash, CURRENT_PATCH)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe("validation-failed")
  })
})
