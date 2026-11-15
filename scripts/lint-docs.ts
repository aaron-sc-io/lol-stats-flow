/**
 * Doc lint - keeps the agent-facing docs honest (AGENTS.md "Definition of done").
 *
 * 1. Every relative Markdown link in AGENTS.md files, docs/, skills, README.md
 *    and DESIGN.md points at a path that exists.
 * 2. Every top-level `src/<dir>` is listed in the root AGENTS.md module map, and
 *    has its own AGENTS.md unless exempt.
 * 3. Every `.opencode/skills/<name>/SKILL.md` has frontmatter whose `name`
 *    matches its directory and a non-empty `description`.
 *
 * Run via `npm run lint:docs`. The checks are pure functions over
 * `{ path, content }` records so they're unit-testable without the real tree.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative, resolve, sep } from "node:path"
import { pathToFileURL } from "node:url"

export type DocFile = { readonly path: string; readonly content: string }
export type DocProblem = { readonly file: string; readonly message: string }

/** `src/` dirs that are documented by the root AGENTS.md / DESIGN.md alone. */
const SRC_DIRS_WITHOUT_OWN_AGENTS = new Set(["lib", "styles"])

const LINK_PATTERN = /\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g

function toPosix(path: string): string {
  return path.split(sep).join("/")
}

function stripCodeBlocks(markdown: string): string {
  return markdown.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "")
}

export function findBrokenLinks(
  files: readonly DocFile[],
  exists: (absolutePath: string) => boolean,
): DocProblem[] {
  const problems: DocProblem[] = []
  for (const file of files) {
    for (const match of stripCodeBlocks(file.content).matchAll(LINK_PATTERN)) {
      const target = match[1]
      if (target === undefined || /^(?:[a-z]+:|#)/i.test(target)) {
        continue
      }
      const pathPart = decodeURIComponent(target.split("#")[0] ?? "")
      if (pathPart.length === 0) {
        continue
      }
      if (!exists(resolve(dirname(file.path), pathPart))) {
        problems.push({ file: file.path, message: `broken link -> ${target}` })
      }
    }
  }
  return problems
}

export function findUndocumentedSrcDirs(
  srcDirs: readonly string[],
  rootAgents: string,
  hasOwnAgents: (dir: string) => boolean,
): DocProblem[] {
  const problems: DocProblem[] = []
  for (const dir of srcDirs) {
    if (!rootAgents.includes(`\`src/${dir}\``)) {
      problems.push({ file: "AGENTS.md", message: `module map is missing src/${dir}` })
    }
    if (!SRC_DIRS_WITHOUT_OWN_AGENTS.has(dir) && !hasOwnAgents(dir)) {
      problems.push({ file: `src/${dir}`, message: "missing AGENTS.md" })
    }
  }
  return problems
}

export function checkSkillFrontmatter(skillDir: string, content: string): DocProblem[] {
  const file = `${skillDir}/SKILL.md`
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content)
  if (match === null) {
    return [{ file, message: "missing YAML frontmatter" }]
  }
  const header = match[1] ?? ""
  const name = /^name:\s*(.+)$/m.exec(header)?.[1]?.trim()
  const description = /^description:\s*(.+)$/m.exec(header)?.[1]?.trim()
  const problems: DocProblem[] = []
  const expected = skillDir.split("/").at(-1)
  if (name !== expected) {
    problems.push({ file, message: `frontmatter name "${name ?? ""}" != directory "${expected}"` })
  }
  if (description === undefined || description.length === 0) {
    problems.push({ file, message: "frontmatter description is empty" })
  }
  return problems
}

const SKIP_DIRS = new Set(["node_modules", "dist", ".git", ".cache", "test-results"])

function walkMarkdown(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) {
      continue
    }
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      walkMarkdown(full, out)
    } else if (entry.name.endsWith(".md")) {
      out.push(full)
    }
  }
}

function listDirs(path: string): string[] {
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
}

export function lintDocs(root: string): DocProblem[] {
  const markdown: string[] = []
  for (const name of ["AGENTS.md", "README.md", "DESIGN.md"]) {
    markdown.push(join(root, name))
  }
  for (const sub of ["docs", "src", "scripts", ".opencode/skills"]) {
    const dir = join(root, sub)
    if (existsSync(dir)) {
      walkMarkdown(dir, markdown)
    }
  }
  const files = markdown
    .filter((path) => existsSync(path))
    // Generated pipeline reports (COVERAGE.md etc.) live under data/ and aren't scanned.
    .map((path) => ({ path, content: readFileSync(path, "utf8") }))

  const problems = findBrokenLinks(files, existsSync)

  const srcDirs = listDirs(join(root, "src")).filter((d) => !d.startsWith("__"))
  problems.push(
    ...findUndocumentedSrcDirs(srcDirs, readFileSync(join(root, "AGENTS.md"), "utf8"), (dir) =>
      existsSync(join(root, "src", dir, "AGENTS.md")),
    ),
  )
  if (!existsSync(join(root, "scripts", "AGENTS.md"))) {
    problems.push({ file: "scripts", message: "missing AGENTS.md" })
  }

  const skillsRoot = join(root, ".opencode", "skills")
  if (existsSync(skillsRoot)) {
    for (const name of listDirs(skillsRoot)) {
      const skillFile = join(skillsRoot, name, "SKILL.md")
      if (!existsSync(skillFile) || !statSync(skillFile).isFile()) {
        problems.push({ file: `.opencode/skills/${name}`, message: "missing SKILL.md" })
        continue
      }
      problems.push(
        ...checkSkillFrontmatter(`.opencode/skills/${name}`, readFileSync(skillFile, "utf8")),
      )
    }
  }

  return problems.map((p) => ({ ...p, file: toPosix(relative(root, resolve(root, p.file))) }))
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = lintDocs(process.cwd())
  for (const problem of problems) {
    console.error(`${problem.file}: ${problem.message}`)
  }
  if (problems.length > 0) {
    console.error(`\nlint:docs - ${problems.length} problem(s)`)
    process.exit(1)
  }
  console.log("lint:docs - ok")
}
