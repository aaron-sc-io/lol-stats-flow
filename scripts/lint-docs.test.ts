import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { checkSkillFrontmatter, findBrokenLinks, findUndocumentedSrcDirs } from "./lint-docs"

describe("findBrokenLinks", () => {
  const root = resolve("/repo")
  const existing = new Set([resolve(root, "docs/a.md"), resolve(root, "src/engine")])
  const exists = (path: string) => existing.has(path)

  it("reports missing relative targets and ignores urls, anchors and code", () => {
    const problems = findBrokenLinks(
      [
        {
          path: resolve(root, "AGENTS.md"),
          content: [
            "[ok](docs/a.md#section)",
            "[dir](src/engine)",
            "[web](https://example.com)",
            "[anchor](#top)",
            "`[code](nope.md)`",
            "[bad](docs/missing.md)",
          ].join("\n"),
        },
      ],
      exists,
    )
    expect(problems.map((p) => p.message)).toEqual(["broken link -> docs/missing.md"])
  })
})

describe("findUndocumentedSrcDirs", () => {
  it("requires a module-map entry and a nested AGENTS.md (except exempt dirs)", () => {
    const problems = findUndocumentedSrcDirs(
      ["engine", "lib", "newmod"],
      "| `src/engine` | x |\n| `src/lib` | y |",
      (dir) => dir === "engine",
    )
    expect(problems).toEqual([
      { file: "AGENTS.md", message: "module map is missing src/newmod" },
      { file: "src/newmod", message: "missing AGENTS.md" },
    ])
  })
})

describe("checkSkillFrontmatter", () => {
  it("accepts matching name + description", () => {
    expect(
      checkSkillFrontmatter("skills/foo", "---\nname: foo\ndescription: does foo\n---\n"),
    ).toEqual([])
  })

  it("flags mismatched name and missing description", () => {
    expect(checkSkillFrontmatter("skills/foo", "---\nname: bar\n---\n")).toHaveLength(2)
  })

  it("flags missing frontmatter", () => {
    expect(checkSkillFrontmatter("skills/foo", "# no header")).toHaveLength(1)
  })
})
