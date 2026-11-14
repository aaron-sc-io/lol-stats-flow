import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"

export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true })
}

export function writeJsonFile(path: string, data: unknown): void {
  ensureDir(dirname(path))
  writeFileSync(path, JSON.stringify(data), "utf-8")
}

export function writeTextFile(path: string, data: string): void {
  ensureDir(dirname(path))
  writeFileSync(path, data, "utf-8")
}

export function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T
}

export function readTextFileIfExists(path: string): string | null {
  return existsSync(path) ? readFileSync(path, "utf-8") : null
}

export function fileExists(path: string): boolean {
  return existsSync(path)
}
