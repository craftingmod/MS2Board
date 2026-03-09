import { describe, expect, test } from "bun:test"
import { buildQueryString, parseRoute } from "./lib/router"

describe("router smoke", () => {
  test("parses all supported routes", () => {
    expect(parseRoute("/")).toEqual({ kind: "home" })
    expect(parseRoute("/board/free")).toEqual({ kind: "board", slug: "free" })
    expect(parseRoute("/post/news/100")).toEqual({
      kind: "post",
      slug: "news",
      articleId: 100,
    })
  })

  test("marks unknown routes as not-found", () => {
    expect(parseRoute("/unknown/path")).toEqual({ kind: "not-found" })
  })

  test("builds query string for URL synchronization", () => {
    const params = new URLSearchParams()
    params.set("q", "test")
    params.set("board", "free")
    params.set("page", "2")

    expect(buildQueryString(params)).toBe("?q=test&board=free&page=2")
  })
})
