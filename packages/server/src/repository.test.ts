import { Database } from "bun:sqlite"
import { describe, expect, test } from "bun:test"
import { BOARD_QUERY_CONFIGS } from "./board_query_config"
import { InvalidBoardError, createPostRepository } from "./repository"

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
`)

  db.exec(`
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
  (1, 'Alpha launch', 'Alice', 1, 70, 'icon-a', 11, 3, 1700000000000, 2, 'tag1', 'Free content 1', NULL),
  (2, 'Bravo patch', 'Bob', 2, 71, 'icon-b', 15, 4, 1700000001000, 1, 'tag2', 'Free content 2', NULL);

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

describe("createPostRepository", () => {
  test("rejects unsupported board slug", () => {
    const db = createTestDatabase()
    const repository = createPostRepository(db, TEST_BOARD_CONFIGS)

    expect(() =>
      repository.listPosts({
        board: "not-supported",
      }),
    ).toThrow(InvalidBoardError)

    db.close()
  })

  test("supports title or author search", () => {
    const db = createTestDatabase()
    const repository = createPostRepository(db, TEST_BOARD_CONFIGS)

    const titleResult = repository.listPosts({
      q: "Alpha",
      page: 1,
      pageSize: 20,
    })

    expect(titleResult.total).toBe(2)
    expect(titleResult.items.some((item) => item.articleId === 1)).toBeTrue()
    expect(titleResult.items.some((item) => item.articleId === 3)).toBeTrue()

    const authorResult = repository.listPosts({
      q: "Bob",
      page: 1,
      pageSize: 20,
    })

    expect(authorResult.total).toBe(1)
    expect(authorResult.items[0]?.articleId).toBe(2)

    db.close()
  })

  test("returns accurate pagination metadata", () => {
    const db = createTestDatabase()
    const repository = createPostRepository(db, TEST_BOARD_CONFIGS)

    const pageOne = repository.listPosts({
      page: 1,
      pageSize: 1,
    })

    expect(pageOne.total).toBe(3)
    expect(pageOne.hasNext).toBeTrue()
    expect(pageOne.items).toHaveLength(1)

    const pageThree = repository.listPosts({
      page: 3,
      pageSize: 1,
    })

    expect(pageThree.hasNext).toBeFalse()
    expect(pageThree.items).toHaveLength(1)

    db.close()
  })

  test("returns detail and null for unknown article", () => {
    const db = createTestDatabase()
    const repository = createPostRepository(db, TEST_BOARD_CONFIGS)

    const existing = repository.getPostDetail("free", 1)
    expect(existing?.title).toBe("Alpha launch")

    const missing = repository.getPostDetail("free", 999)
    expect(missing).toBeNull()

    db.close()
  })
})
