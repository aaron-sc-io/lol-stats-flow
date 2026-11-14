/**
 * Resolves CDragon's hashed bin keys (`{0a3e0478}`-style tokens, FNV-1a32 or
 * truncated-XXH64 depending on table) to human names using the published hash
 * lists under `raw.communitydragon.org/data/hashes/lol/`. Lists are optional —
 * `fetch.ts` tolerates them being unavailable, so this resolver must too: an
 * unresolved hash is preserved verbatim, never thrown on.
 */

const HASH_TOKEN_PATTERN = /^\{([0-9a-f]{8})\}$/i

export type HashTable = ReadonlyMap<string, string>

export function parseHashListText(text: string): HashTable {
  const table = new Map<string, string>()
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (trimmed.length === 0) {
      continue
    }
    const spaceIndex = trimmed.indexOf(" ")
    if (spaceIndex === -1) {
      continue
    }
    const hash = trimmed.slice(0, spaceIndex).toLowerCase()
    const name = trimmed.slice(spaceIndex + 1).trim()
    table.set(hash, name)
  }
  return table
}

export function mergeHashTables(tables: ReadonlyArray<HashTable | null>): HashTable {
  const merged = new Map<string, string>()
  for (const table of tables) {
    if (table === null) {
      continue
    }
    for (const [hash, name] of table) {
      merged.set(hash, name)
    }
  }
  return merged
}

/** Returns the resolved name for a `{hash}`-shaped key, or the original
 * string unchanged if it isn't hash-shaped or isn't in the table. */
export function resolveHashToken(token: string, table: HashTable): string {
  const match = HASH_TOKEN_PATTERN.exec(token)
  if (match === null) {
    return token
  }
  const hash = match[1]
  if (hash === undefined) {
    return token
  }
  return table.get(hash) ?? token
}

export function isUnresolvedHashToken(token: string): boolean {
  return HASH_TOKEN_PATTERN.test(token)
}
