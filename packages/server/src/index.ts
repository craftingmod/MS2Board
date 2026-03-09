import { createApiHandler } from "./app"
import { openArchiveDatabase, getDefaultArchiveDbPath } from "./database"
import { createPostRepository } from "./repository"

const port = Number(Bun.env.PORT ?? 3000)
const dbPath = Bun.env.MS2_ARCHIVE_DB_PATH ?? getDefaultArchiveDbPath()

const db = openArchiveDatabase(dbPath)
const repository = createPostRepository(db)
const handler = createApiHandler(repository)

Bun.serve({
  port,
  fetch: handler,
})

console.log(`[server] listening on http://localhost:${port}`)
console.log(`[server] using archive DB at ${dbPath}`)
