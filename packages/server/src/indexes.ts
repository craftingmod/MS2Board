import { type Database } from "bun:sqlite"
import { BOARD_QUERY_CONFIGS } from "./board_query_config"

const BASE_INDEX_COLUMNS = ["createdAt", "authorName"]

function getTableColumns(db: Database, tableName: string): Set<string> {
  const rows = db.query(`PRAGMA table_info(${tableName})`).all() as Array<{
    name: string
  }>

  return new Set(rows.map((row) => row.name))
}

function createIndexIfPossible(
  db: Database,
  tableName: string,
  columnName: string,
): boolean {
  const indexName = `idx_${tableName}_${columnName}`
  db.exec(
    `CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName} (${columnName})`,
  )
  return true
}

export function ensureBoardIndexes(db: Database): {
  created: string[]
  skipped: string[]
} {
  const created: string[] = []
  const skipped: string[] = []

  for (const board of BOARD_QUERY_CONFIGS) {
    const tableColumns = getTableColumns(db, board.tableName)
    const targetColumns = [...BASE_INDEX_COLUMNS]

    if (board.hasTitleColumn) {
      targetColumns.push("title")
    }

    for (const columnName of targetColumns) {
      if (!tableColumns.has(columnName)) {
        skipped.push(`${board.tableName}.${columnName}`)
        continue
      }

      createIndexIfPossible(db, board.tableName, columnName)
      created.push(`${board.tableName}.${columnName}`)
    }
  }

  return {
    created,
    skipped,
  }
}
