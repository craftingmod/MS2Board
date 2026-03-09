import { Database } from "bun:sqlite"
import { mkdir, rm } from "node:fs/promises"
import path from "node:path"
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
CREATE TABLE FreeComment (
  articleId INTEGER NOT NULL,
  commentIndex INTEGER NOT NULL,
  authorName TEXT NOT NULL,
  content TEXT NOT NULL,
  createdAt INTEGER NOT NULL
);
CREATE TABLE QnAComment (
  articleId INTEGER NOT NULL,
  commentIndex INTEGER NOT NULL,
  authorName TEXT NOT NULL,
  content TEXT NOT NULL,
  createdAt INTEGER NOT NULL
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
INSERT INTO FreeComment (articleId, commentIndex, authorName, content, createdAt) VALUES
  (1, 0, 'Dora', 'first', 1700000000100),
  (1, 1, 'Evan', 'second', 1700000000200);
INSERT INTO QnAComment (articleId, commentIndex, authorName, content, createdAt) VALUES
  (3, 0, 'Fiona', 'answer', 1700000000300);
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

  test("returns comments in descending order with pagination", async () => {
    const db = createTestDatabase()
    const repository = createPostRepository(db, TEST_BOARD_CONFIGS)
    const handler = createApiHandler(repository)

    const response = await handler(
      new Request(
        "http://localhost/api/posts/free/1/comments?page=1&pageSize=1",
      ),
    )

    expect(response.status).toBe(200)

    const body = (await response.json()) as {
      items: Array<{ commentIndex: number; authorName: string }>
      total: number
      hasNext: boolean
    }

    expect(body.total).toBe(2)
    expect(body.items).toHaveLength(1)
    expect(body.items[0]?.commentIndex).toBe(1)
    expect(body.items[0]?.authorName).toBe("Evan")
    expect(body.hasNext).toBeTrue()

    db.close()
  })

  test("serves archive image as avif regardless of requested extension", async () => {
    const db = createTestDatabase()
    const repository = createPostRepository(db, TEST_BOARD_CONFIGS)

    const imageRoot = path.resolve(import.meta.dir, "./.tmp-image-root")
    const imagePath = path.join(imageRoot, "knowhow", "17760", "17760_001.avif")

    await mkdir(path.dirname(imagePath), { recursive: true })
    await Bun.write(imagePath, "fake-avif")

    const handler = createApiHandler(repository, {
      imagesRootDir: imageRoot,
    })

    const response = await handler(
      new Request("http://localhost/images/knowhow/17760/17760_001.png"),
    )

    expect(response.status).toBe(200)
    expect(await response.text()).toBe("fake-avif")

    await rm(imageRoot, { recursive: true, force: true })
    db.close()
  })

  test("serves events list from fse html files", async () => {
    const db = createTestDatabase()
    const repository = createPostRepository(db, TEST_BOARD_CONFIGS)

    const fseRoot = path.resolve(import.meta.dir, "./.tmp-fse-root-list")
    await mkdir(fseRoot, { recursive: true })
    await Bun.write(path.join(fseRoot, "20220609_Event.html"), "<h1>Event</h1>")
    await Bun.write(path.join(fseRoot, "ignore.html"), "<h1>Ignore</h1>")

    const handler = createApiHandler(repository, { fseRootDir: fseRoot })

    const response = await handler(new Request("http://localhost/events/"))

    expect(response.status).toBe(200)
    const body = await response.text()
    expect(body).toContain("/events/20220609/Event")
    expect(body).toContain("20220609_Event")
    expect(body).toContain("/events/ignore")
    expect(body).toContain(">ignore<")

    await rm(fseRoot, { recursive: true, force: true })
    db.close()
  })

  test("serves fse event html via /events/:date/:name", async () => {
    const db = createTestDatabase()
    const repository = createPostRepository(db, TEST_BOARD_CONFIGS)

    const fseRoot = path.resolve(import.meta.dir, "./.tmp-fse-root-event")
    await mkdir(fseRoot, { recursive: true })
    await Bun.write(
      path.join(fseRoot, "20220609_Event.html"),
      '<h1>Event Body</h1><link href="res/20220609_Event/style.css" rel="stylesheet" />',
    )

    const handler = createApiHandler(repository, { fseRootDir: fseRoot })

    const response = await handler(
      new Request("http://localhost/events/20220609/Event"),
    )

    expect(response.status).toBe(200)
    const body = await response.text()
    expect(body).toContain("Event Body")
    expect(body).toContain('href="/res/20220609_Event/style.css"')

    await rm(fseRoot, { recursive: true, force: true })
    db.close()
  })

  test("serves simple fse html via /events/:slug", async () => {
    const db = createTestDatabase()
    const repository = createPostRepository(db, TEST_BOARD_CONFIGS)

    const fseRoot = path.resolve(import.meta.dir, "./.tmp-fse-root-simple")
    await mkdir(fseRoot, { recursive: true })
    await Bun.write(path.join(fseRoot, "Beginner.html"), "<h1>Beginner Event</h1>")

    const handler = createApiHandler(repository, { fseRootDir: fseRoot })

    const response = await handler(new Request("http://localhost/events/Beginner"))

    expect(response.status).toBe(200)
    expect(await response.text()).toContain("Beginner Event")

    await rm(fseRoot, { recursive: true, force: true })
    db.close()
  })

  test("serves fse resource file via /res/*", async () => {
    const db = createTestDatabase()
    const repository = createPostRepository(db, TEST_BOARD_CONFIGS)

    const fseRoot = path.resolve(import.meta.dir, "./.tmp-fse-root-res")
    const resourcePath = path.join(fseRoot, "res", "20220609_Event", "style.css")
    await mkdir(path.dirname(resourcePath), { recursive: true })
    await Bun.write(resourcePath, "body { color: red; }")

    const handler = createApiHandler(repository, { fseRootDir: fseRoot })

    const response = await handler(
      new Request("http://localhost/res/20220609_Event/style.css"),
    )

    expect(response.status).toBe(200)
    expect(await response.text()).toContain("color: red")

    await rm(fseRoot, { recursive: true, force: true })
    db.close()
  })
})


