import { Database } from "bun:sqlite"
import path from "node:path"

export type OpenArchiveDatabaseOptions = {
  readonly?: boolean
}

export function getDefaultArchiveDbPath(): string {
  return path.resolve(import.meta.dir, "../../build/data/ms2archive.db")
}

export function openArchiveDatabase(
  dbPath = getDefaultArchiveDbPath(),
  options: OpenArchiveDatabaseOptions = {},
): Database {
  if (options.readonly ?? true) {
    return new Database(dbPath, {
      readonly: true,
    })
  }

  return new Database(dbPath)
}
