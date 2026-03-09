import { Database } from "bun:sqlite"
import { describe, expect, test } from "bun:test"
import { BOARD_QUERY_CONFIGS } from "./board_query_config"
import { createApiHandler } from "./app"
import { createPostRepository } from "./repository"

const TEST_BOARD_CONFIGS = BOARD_QUERY_CONFIGS.filter((config) =>
  ["free", "qna"].includes(config.slug),
)

function createTestDatabase(): Database {
  const db = new Database(":memory:")

  db.exec(`
CREATE TABLE FreeBoard (
  articleId INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  authorName TEXT NOT NULL,
  authorJob INTEGER,
  authorLevel INTEGER,
  authorIcon TEXT,
  viewCount INTEGER NOT NULL,
  likeCount INTEGER NOT NULL,
  createdAt INTEGER NOT NULL,
  commentCount INTEGER NOT NULL,
  tags TEXT,
  content TEXT NOT NULL,
  attachments TEXT
);
CREATE TABLE QnABoard (
  articleId INTEGER PRIMARY KEY,
  content TEXT NOT NULL,
  authorName TEXT NOT NULL,
  authorJob INTEGER,
  authorLevel INTEGER,
  createdAt INTEGER NOT NULL,
  commentCount INTEGER NOT NULL,
  tags TEXT
);
INSERT INTO FreeBoard (
  articleId,
  title,
  authorName,
  authorJob,
  authorLevel,
  authorIcon,
  viewCount,
  likeCount,
  createdAt,
  commentCount,
  tags,
  content,
  attachments
) VALUES
  (1, 'Alpha launch', 'Alice', 1, 70, 'icon-a', 11, 3, 1700000000000, 2, 'tag1', 'Free content 1', NULL);
INSERT INTO QnABoard (
  articleId,
  content,
  authorName,
  authorJob,
  authorLevel,
  createdAt,
  commentCount,
  tags
) VALUES
  (3, 'Need alpha help', 'Carol', 3, 60, 1700000002000, 5, 'question');
`)

  return db
}

describe("API integration", () => {
  test("returns board list", async () => {
    const db = createTestDatabase()
    const repository = createPostRepository(db, TEST_BOARD_CONFIGS)
    const handler = createApiHandler(repository)

    const response = await handler(new Request("http://localhost/api/boards"))
    expect(response.status).toBe(200)

    const body = (await response.json()) as { items: Array<{ slug: string }> }
    expect(body.items).toHaveLength(2)

    db.close()
  })

  test("returns 400 for invalid board filter", async () => {
    const db = createTestDatabase()
    const repository = createPostRepository(db, TEST_BOARD_CONFIGS)
    const handler = createApiHandler(repository)

    const response = await handler(
      new Request("http://localhost/api/posts?board=unknown"),
    )

    expect(response.status).toBe(400)
    db.close()
  })

  test("returns 404 for missing detail", async () => {
    const db = createTestDatabase()
    const repository = createPostRepository(db, TEST_BOARD_CONFIGS)
    const handler = createApiHandler(repository)

    const response = await handler(
      new Request("http://localhost/api/posts/free/999"),
    )

    expect(response.status).toBe(404)
    db.close()
  })

  test("returns detail for existing post", async () => {
    const db = createTestDatabase()
    const repository = createPostRepository(db, TEST_BOARD_CONFIGS)
    const handler = createApiHandler(repository)

    const response = await handler(
      new Request("http://localhost/api/posts/free/1"),
    )
    expect(response.status).toBe(200)

    const body = (await response.json()) as {
      articleId: number
      board: { slug: string }
    }
    expect(body.articleId).toBe(1)
    expect(body.board.slug).toBe("free")

    db.close()
  })
})
