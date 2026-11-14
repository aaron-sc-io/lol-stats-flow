/**
 * Token lint — enforces DESIGN.md §2: raw hex colors, rgb()/rgba()/hsl()/
 * hsla() literals, and raw px font-size declarations may only appear in
 * `src/styles/tokens.css`. Every other file under `src/` must reference the
 * semantic tokens instead.
 *
 * Run via `npm run lint:tokens`. Exported `findTokenViolations` is a pure
 * function so it can be unit-tested against fixtures without touching the
 * real `src/` tree.
 */
import { readdirSync, readFileSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { pathToFileURL } from "node:url"

const SCANNABLE_EXTENSIONS = [".css", ".ts", ".tsx"] as const
const EXEMPT_RELATIVE_PATH = "styles/tokens.css"

const HEX_COLOR_PATTERN = /#[0-9a-fA-F]{3,8}\b/
const COLOR_FUNCTION_PATTERN = /\b(?:rgba?|hsla?)\(/i
const RAW_FONT_SIZE_PATTERN = /(?:font-size|fontSize)\s*:\s*['"`]?\s*\d+(?:\.\d+)?px\b/i

type TokenViolationRule = "hex-color" | "color-function" | "raw-font-size"

export type TokenViolation = {
  readonly filePath: string
  readonly lineNumber: number
  readonly rule: TokenViolationRule
  readonly snippet: string
}

function isScannableFile(filePath: string): boolean {
  return SCANNABLE_EXTENSIONS.some((extension) => filePath.endsWith(extension))
}

function toPosixPath(filePath: string): string {
  return filePath.split(sep).join("/")
}

function isExemptFile(relativePath: string): boolean {
  return toPosixPath(relativePath) === EXEMPT_RELATIVE_PATH
}

function listFilesRecursively(rootDir: string): string[] {
  const entries = readdirSync(rootDir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const fullPath = join(rootDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...listFilesRecursively(fullPath))
    } else if (entry.isFile()) {
      files.push(fullPath)
    }
  }
  return files
}

function checkLine(filePath: string, lineNumber: number, line: string): TokenViolation[] {
  const violations: TokenViolation[] = []
  const snippet = line.trim()
  if (HEX_COLOR_PATTERN.test(line)) {
    violations.push({ filePath, lineNumber, rule: "hex-color", snippet })
  }
  if (COLOR_FUNCTION_PATTERN.test(line)) {
    violations.push({ filePath, lineNumber, rule: "color-function", snippet })
  }
  if (RAW_FONT_SIZE_PATTERN.test(line)) {
    violations.push({ filePath, lineNumber, rule: "raw-font-size", snippet })
  }
  return violations
}

/** Scans every `.css`/`.ts`/`.tsx` file under `rootDir`, except the file at
 * `styles/tokens.css` relative to it, for banned raw-value patterns. */
export function findTokenViolations(rootDir: string): TokenViolation[] {
  const violations: TokenViolation[] = []
  for (const filePath of listFilesRecursively(rootDir)) {
    if (!isScannableFile(filePath)) {
      continue
    }
    const relativePath = relative(rootDir, filePath)
    if (isExemptFile(relativePath)) {
      continue
    }
    const content = readFileSync(filePath, "utf-8")
    const lines = content.split("\n")
    lines.forEach((line, index) => {
      violations.push(...checkLine(relativePath, index + 1, line))
    })
  }
  return violations
}

function printReport(violations: readonly TokenViolation[]): void {
  for (const violation of violations) {
    console.error(
      `${violation.filePath}:${violation.lineNumber} [${violation.rule}] ${violation.snippet}`,
    )
  }
}

function runCli(): void {
  const srcDir = join(process.cwd(), "src")
  const violations = findTokenViolations(srcDir)
  if (violations.length > 0) {
    printReport(violations)
    console.error(
      `\nToken lint failed: ${violations.length} violation(s) found outside src/styles/tokens.css.`,
    )
    process.exit(1)
  }
  console.log("Token lint passed: no raw color or font-size literals outside tokens.css.")
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMainModule) {
  runCli()
}
