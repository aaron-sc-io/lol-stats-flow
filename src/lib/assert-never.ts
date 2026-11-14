/**
 * Exhaustiveness helper for discriminated unions. Call in the `default`/
 * final branch of a `switch` so the compiler errors if a new variant is
 * added without handling it anywhere this is used.
 */
export function assertNever(value: never): never {
  throw new Error(`Unreachable case: ${JSON.stringify(value)}`)
}
