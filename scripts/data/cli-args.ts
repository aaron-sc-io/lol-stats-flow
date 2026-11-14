export type ParsedArgs = {
  readonly patch: string
  readonly force: boolean
  readonly offline: boolean
  readonly positionals: readonly string[]
}

/** Minimal flag parser for the data CLI scripts: `--patch <v>`, `--force`,
 * `--offline`, plus positional args (used by diff's `<a> <b>`). */
export function parseArgs(argv: readonly string[]): ParsedArgs {
  let patch = "latest"
  let force = false
  let offline = false
  const positionals: string[] = []

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--patch") {
      const value = argv[i + 1]
      if (value === undefined) {
        throw new Error("--patch requires a value")
      }
      patch = value
      i++
    } else if (arg === "--force") {
      force = true
    } else if (arg === "--offline") {
      offline = true
    } else if (arg !== undefined && !arg.startsWith("--")) {
      positionals.push(arg)
    }
  }

  return { patch, force, offline, positionals }
}
