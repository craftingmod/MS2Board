import { expect, test } from "bun:test"
import { getDefaultArchiveDbPath, openArchiveDatabase } from "./database"
import { createPostRepository } from "./repository"

test("real archive integration: list and search", () => {
  const dbPath = getDefaultArchiveDbPath()

  let db
  try {
    db = openArchiveDatabase(dbPath)
  } catch {
    console.warn(`[integration] archive DB not found at ${dbPath}; skipped`)
    return
  }

  const repository = createPostRepository(db)

  const allPosts = repository.listPosts({
    page: 1,
    pageSize: 10,
  })

  expect(allPosts.items.length).toBeGreaterThan(0)
  expect(allPosts.total).toBeGreaterThan(0)

  const representative = allPosts.items[0]
  const boardPosts = repository.listPosts({
    board: representative.board.slug,
    page: 1,
    pageSize: 5,
  })

  expect(
    boardPosts.items.every(
      (item) => item.board.slug === representative.board.slug,
    ),
  ).toBeTrue()

  const searchKeyword = representative.authorName.slice(0, 2)
  const searched = repository.listPosts({
    board: representative.board.slug,
    q: searchKeyword,
    page: 1,
    pageSize: 5,
  })

  expect(searched.total).toBeGreaterThan(0)
  db.close()
})
