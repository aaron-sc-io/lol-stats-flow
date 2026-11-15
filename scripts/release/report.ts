/**
 * Version safety report (ADR 0005). Versioning is the one human-gated action:
 * this script gathers everything a human needs to approve a version bump and
 * renders it as Markdown.
 *
 *   npm run release:report                      # dry run → stdout
 *   npm run release:report -- --bump minor      # force a bump level
 *   npm run release:report -- --write           # write docs/releases/v<x>.md + CHANGELOG entry
 *
 * With `--write` and `GITHUB_OUTPUT` set, emits `version=` and `verdict=` for
 * `.github/workflows/release.yml`. The pure functions (`parseCommit`,
 * `decideBump`, `bumpVersion`, `assessRisks`, `renderReport`) are unit-tested.
 */
import { execFileSync } from "node:child_process"
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

export type Bump = "major" | "minor" | "patch"
export type Commit = {
  readonly hash: string
  readonly type: string
  readonly scope: string | null
  readonly subject: string
  readonly breaking: boolean
}
export type Severity = "attention" | "info"
export type Risk = { readonly severity: Severity; readonly check: string; readonly detail: string }

const CONVENTIONAL = /^(\w+)(?:\(([^)]*)\))?(!)?:\s*(.+)$/

export function parseCommit(hash: string, subject: string, body: string): Commit {
  const match = CONVENTIONAL.exec(subject)
  const breakingBody = /^BREAKING[ -]CHANGE:/m.test(body)
  if (match === null) {
    return { hash, type: "other", scope: null, subject, breaking: breakingBody }
  }
  return {
    hash,
    type: match[1] ?? "other",
    scope: match[2] ?? null,
    subject: match[4] ?? subject,
    breaking: match[3] === "!" || breakingBody,
  }
}

/** Conventional-commit semver. Pre-1.0, breaking changes bump minor. */
export function decideBump(commits: readonly Commit[], currentVersion: string): Bump {
  const preOne = currentVersion.startsWith("0.")
  if (commits.some((c) => c.breaking)) {
    return preOne ? "minor" : "major"
  }
  if (commits.some((c) => c.type === "feat")) {
    return "minor"
  }
  return "patch"
}

export function bumpVersion(version: string, bump: Bump): string {
  const [major = 0, minor = 0, patch = 0] = version
    .split(".")
    .map((part) => Number.parseInt(part, 10))
  if (bump === "major") return `${major + 1}.0.0`
  if (bump === "minor") return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

export type RiskInputs = {
  readonly commits: readonly Commit[]
  /** `git diff --name-status` lines: status letter + path. */
  readonly changes: readonly { readonly status: string; readonly path: string }[]
  readonly canvasSchemaVersion: { readonly before: string | null; readonly after: string | null }
  readonly snapshotSchemaVersion: { readonly before: string | null; readonly after: string | null }
  readonly dependencies: {
    readonly before: Readonly<Record<string, string>>
    readonly after: Readonly<Record<string, string>>
  }
}

function majorOf(range: string): string | null {
  return /(\d+)/.exec(range)?.[1] ?? null
}

export function assessRisks(input: RiskInputs): Risk[] {
  const risks: Risk[] = []
  const changed = (prefix: string) => input.changes.filter((c) => c.path.startsWith(prefix))

  if (input.commits.length === 0) {
    risks.push({
      severity: "attention",
      check: "commits",
      detail: "No commits since the last tag.",
    })
  }
  const unconventional = input.commits.filter((c) => c.type === "other")
  if (unconventional.length > 0) {
    risks.push({
      severity: "info",
      check: "commits",
      detail: `${unconventional.length} non-conventional commit(s); bump inferred without them.`,
    })
  }

  const persistenceCore = input.changes.filter((c) =>
    /^src\/persistence\/(schema|migrations|share-url)\.ts$/.test(c.path),
  )
  const canvasBumped = input.canvasSchemaVersion.before !== input.canvasSchemaVersion.after
  if (canvasBumped) {
    const fixtureAdded = input.changes.some(
      (c) => c.status === "A" && c.path.startsWith("src/persistence/__fixtures__/"),
    )
    const migrationTouched = input.changes.some((c) => c.path === "src/persistence/migrations.ts")
    risks.push({
      severity: fixtureAdded && migrationTouched ? "info" : "attention",
      check: "canvas schema",
      detail: `CANVAS_SCHEMA_VERSION ${input.canvasSchemaVersion.before ?? "?"} → ${input.canvasSchemaVersion.after ?? "?"}; migration ${migrationTouched ? "changed" : "NOT changed"}, new fixture ${fixtureAdded ? "added" : "NOT added"}.`,
    })
  } else if (persistenceCore.length > 0) {
    risks.push({
      severity: "attention",
      check: "canvas schema",
      detail: `${persistenceCore.map((c) => c.path).join(", ")} changed without a CANVAS_SCHEMA_VERSION bump - confirm old saved canvases and share links still parse.`,
    })
  }

  const modifiedFixtures = input.changes.filter(
    (c) =>
      c.status !== "A" &&
      (c.path.startsWith("src/persistence/__fixtures__/") ||
        c.path.startsWith("src/engine/__golden__/fixtures/")),
  )
  if (modifiedFixtures.length > 0) {
    risks.push({
      severity: "attention",
      check: "frozen fixtures",
      detail: `Append-only fixtures modified/deleted: ${modifiedFixtures.map((c) => c.path).join(", ")}.`,
    })
  }
  const pinnedGolden = changed("src/engine/__golden__/pinned/")
  if (pinnedGolden.length > 0) {
    risks.push({
      severity: "attention",
      check: "pinned golden tests",
      detail: `Hand-verified expectations changed: ${pinnedGolden.map((c) => c.path).join(", ")} - confirm each cites a source.`,
    })
  }

  if (input.snapshotSchemaVersion.before !== input.snapshotSchemaVersion.after) {
    risks.push({
      severity: "attention",
      check: "snapshot schema",
      detail: `SNAPSHOT_SCHEMA_VERSION ${input.snapshotSchemaVersion.before ?? "?"} → ${input.snapshotSchemaVersion.after ?? "?"}; older pinned snapshots must have been regenerated.`,
    })
  }

  for (const [name, after] of Object.entries(input.dependencies.after)) {
    const before = input.dependencies.before[name]
    if (before === undefined) {
      risks.push({ severity: "info", check: "dependencies", detail: `Added ${name}@${after}.` })
    } else if (majorOf(before) !== majorOf(after)) {
      risks.push({
        severity: "attention",
        check: "dependencies",
        detail: `Major bump ${name} ${before} → ${after}.`,
      })
    }
  }
  for (const name of Object.keys(input.dependencies.before)) {
    if (!(name in input.dependencies.after)) {
      risks.push({ severity: "info", check: "dependencies", detail: `Removed ${name}.` })
    }
  }

  const engine = changed("src/engine/").filter((c) => !c.path.includes(".test."))
  if (engine.length > 0) {
    risks.push({
      severity: "info",
      check: "engine",
      detail: `${engine.length} engine source file(s) changed - damage numbers may differ.`,
    })
  }
  const snapshots = new Set(changed("data/snapshots/").map((c) => c.path.split("/")[2] ?? ""))
  if (snapshots.size > 0) {
    risks.push({
      severity: "info",
      check: "data",
      detail: `Snapshot changes for patch(es): ${[...snapshots].join(", ")}.`,
    })
  }
  const workflows = changed(".github/workflows/")
  if (workflows.length > 0) {
    risks.push({
      severity: "info",
      check: "automation",
      detail: `Workflows changed: ${workflows.map((c) => c.path).join(", ")}.`,
    })
  }
  return risks
}

const SECTION_TITLES: Readonly<Record<string, string>> = {
  feat: "Features",
  fix: "Fixes",
  perf: "Performance",
  refactor: "Refactors",
  docs: "Docs",
  test: "Tests",
  chore: "Chores",
  ci: "CI",
  build: "Build",
  style: "Style",
}

export function renderChangelogSection(
  version: string,
  date: string,
  commits: readonly Commit[],
): string {
  const lines = [`## v${version} - ${date}`, ""]
  const breaking = commits.filter((c) => c.breaking)
  if (breaking.length > 0) {
    lines.push("### Breaking", "", ...breaking.map(formatCommit), "")
  }
  const groups = new Map<string, Commit[]>()
  for (const commit of commits) {
    const key = commit.type in SECTION_TITLES ? commit.type : "other"
    groups.set(key, [...(groups.get(key) ?? []), commit])
  }
  for (const key of [...Object.keys(SECTION_TITLES), "other"]) {
    const group = groups.get(key)
    if (group !== undefined) {
      lines.push(`### ${SECTION_TITLES[key] ?? "Other"}`, "", ...group.map(formatCommit), "")
    }
  }
  return lines.join("\n")
}

function formatCommit(commit: Commit): string {
  const scope = commit.scope === null ? "" : `**${commit.scope}:** `
  return `- ${scope}${commit.subject} (${commit.hash.slice(0, 7)})`
}

export type ReportInput = {
  readonly fromTag: string | null
  readonly currentVersion: string
  readonly nextVersion: string
  readonly bump: Bump
  readonly suggestedBump: Bump
  readonly date: string
  readonly commits: readonly Commit[]
  readonly risks: readonly Risk[]
  readonly changedFiles: number
}

export function verdictOf(risks: readonly Risk[]): "SAFE" | "NEEDS ATTENTION" {
  return risks.some((r) => r.severity === "attention") ? "NEEDS ATTENTION" : "SAFE"
}

export function renderReport(input: ReportInput): string {
  const verdict = verdictOf(input.risks)
  const attention = input.risks.filter((r) => r.severity === "attention")
  const info = input.risks.filter((r) => r.severity === "info")
  const bumpNote =
    input.bump === input.suggestedBump
      ? `${input.bump} (from conventional commits)`
      : `${input.bump} (override; commits suggest ${input.suggestedBump})`
  const riskRows = (list: readonly Risk[]) =>
    list.length === 0 ? ["_None._"] : list.map((r) => `- **${r.check}:** ${r.detail}`)

  return [
    `# Release v${input.nextVersion} - safety report`,
    "",
    `**Verdict: ${verdict}**`,
    "",
    "| | |",
    "| --- | --- |",
    `| Version | ${input.currentVersion} → **${input.nextVersion}** |`,
    `| Bump | ${bumpNote} |`,
    `| Range | \`${input.fromTag ?? "(repo start)"}..HEAD\` |`,
    `| Commits / files | ${input.commits.length} / ${input.changedFiles} |`,
    `| Generated | ${input.date} |`,
    "",
    "## Needs attention",
    "",
    ...riskRows(attention),
    "",
    "## Informational",
    "",
    ...riskRows(info),
    "",
    "## Gates",
    "",
    "CI on the release PR must be green (lint, token + doc lint, typecheck, unit + golden tests, data gates, build, e2e).",
    "A human must approve the PR; `release-guard.yml` enforces it.",
    "",
    renderChangelogSection(input.nextVersion, input.date.slice(0, 10), input.commits).replace(
      /^## /,
      "## Changes in ",
    ),
  ].join("\n")
}

// ---- git / fs adapters ------------------------------------------------------

function git(args: readonly string[]): string {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()
}

function tryGit(args: readonly string[]): string | null {
  try {
    return git(args)
  } catch {
    return null
  }
}

function readCommits(range: string): Commit[] {
  const raw = tryGit(["log", "--no-merges", "--format=%H%x1f%s%x1f%b%x1e", range]) ?? ""
  return raw
    .split("\x1e")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const [hash = "", subject = "", body = ""] = entry.split("\x1f")
      return parseCommit(hash, subject, body)
    })
    .filter((commit) => !/^release\b/.test(commit.scope ?? "") || commit.type !== "chore")
}

function readChanges(fromRef: string | null): { status: string; path: string }[] {
  const raw =
    fromRef === null ? git(["ls-files"]) : git(["diff", "--name-status", `${fromRef}..HEAD`])
  return raw
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => {
      if (fromRef === null) return { status: "A", path: line }
      const parts = line.split("\t")
      return { status: (parts[0] ?? "M").charAt(0), path: parts.at(-1) ?? "" }
    })
}

function constantAt(ref: string | null, path: string, name: string): string | null {
  const source =
    ref === null
      ? existsSync(path)
        ? readFileSync(path, "utf8")
        : null
      : tryGit(["show", `${ref}:${path}`])
  if (source === null) return null
  return new RegExp(`${name}\\s*=\\s*(\\d+)`).exec(source)?.[1] ?? null
}

function depsAt(ref: string | null): Record<string, string> {
  const raw =
    ref === null ? readFileSync("package.json", "utf8") : tryGit(["show", `${ref}:package.json`])
  if (raw === null) return {}
  const pkg = JSON.parse(raw) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  return { ...pkg.devDependencies, ...pkg.dependencies }
}

function parseArgs(argv: readonly string[]): { bump: Bump | "auto"; write: boolean } {
  const bumpIndex = argv.indexOf("--bump")
  const raw = bumpIndex >= 0 ? argv[bumpIndex + 1] : "auto"
  if (raw !== "auto" && raw !== "major" && raw !== "minor" && raw !== "patch") {
    throw new Error(`--bump must be auto|major|minor|patch, got "${raw ?? ""}"`)
  }
  return { bump: raw, write: argv.includes("--write") }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  const fromTag = tryGit(["describe", "--tags", "--abbrev=0", "--match", "v*"])
  const currentVersion = (JSON.parse(readFileSync("package.json", "utf8")) as { version: string })
    .version
  const commits = readCommits(fromTag === null ? "HEAD" : `${fromTag}..HEAD`)
  const changes = readChanges(fromTag)
  const suggestedBump = decideBump(commits, currentVersion)
  const bump = args.bump === "auto" ? suggestedBump : args.bump
  const nextVersion = bumpVersion(currentVersion, bump)
  const risks = assessRisks({
    commits,
    changes,
    canvasSchemaVersion: {
      before: constantAt(fromTag, "src/persistence/schema.ts", "CANVAS_SCHEMA_VERSION"),
      after: constantAt(null, "src/persistence/schema.ts", "CANVAS_SCHEMA_VERSION"),
    },
    snapshotSchemaVersion: {
      before: constantAt(fromTag, "src/data/snapshot-schema.ts", "SNAPSHOT_SCHEMA_VERSION"),
      after: constantAt(null, "src/data/snapshot-schema.ts", "SNAPSHOT_SCHEMA_VERSION"),
    },
    dependencies: { before: depsAt(fromTag), after: depsAt(null) },
  })
  const date = new Date().toISOString()
  const report = renderReport({
    fromTag,
    currentVersion,
    nextVersion,
    bump,
    suggestedBump,
    date,
    commits,
    risks,
    changedFiles: changes.length,
  })

  if (!args.write) {
    process.stdout.write(`${report}\n`)
    return
  }

  const releasesDir = join("docs", "releases")
  mkdirSync(releasesDir, { recursive: true })
  writeFileSync(join(releasesDir, `v${nextVersion}.md`), `${report}\n`)

  const changelogPath = "CHANGELOG.md"
  const header =
    "# Changelog\n\nGenerated by `npm run release:report -- --write`. Do not edit by hand.\n\n"
  const existing = existsSync(changelogPath)
    ? readFileSync(changelogPath, "utf8").replace(header, "")
    : ""
  writeFileSync(
    changelogPath,
    `${header}${renderChangelogSection(nextVersion, date.slice(0, 10), commits)}\n${existing}`,
  )

  const verdict = verdictOf(risks)
  if (process.env.GITHUB_OUTPUT !== undefined) {
    appendFileSync(process.env.GITHUB_OUTPUT, `version=${nextVersion}\nverdict=${verdict}\n`)
  }
  console.log(`Wrote docs/releases/v${nextVersion}.md (${verdict}) and CHANGELOG.md`)
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
