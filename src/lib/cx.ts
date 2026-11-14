/**
 * Tiny classnames joiner. Falsy values (false/undefined/null/"") are
 * dropped; everything else is joined with a single space. Used across every
 * component so conditional CSS-module classes stay readable:
 *
 *   cx(styles.button, variant === "ghost" && styles.ghost, className)
 */
export function cx(...parts: ReadonlyArray<string | false | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part)).join(" ")
}
