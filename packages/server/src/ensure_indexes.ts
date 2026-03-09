import { openArchiveDatabase, getDefaultArchiveDbPath } from "./database"
import { ensureBoardIndexes } from "./indexes"

export function runEnsureIndexes(dbPath = getDefaultArchiveDbPath()): void {
  const db = openArchiveDatabase(dbPath, {
    readonly: false,
  })

  const result = ensureBoardIndexes(db)

  console.log(`[indexes] ensured indexes: ${result.created.length}`)
  if (result.skipped.length > 0) {
    console.log(
      `[indexes] skipped missing columns: ${result.skipped.join(", ")}`,
    )
  }
}

if (import.meta.main) {
  const dbPath = Bun.env.MS2_ARCHIVE_DB_PATH ?? getDefaultArchiveDbPath()
  runEnsureIndexes(dbPath)
}
