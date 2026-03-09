import { type SortOption } from "@ms2board/common"
import { InvalidBoardError, type PostRepository } from "./repository"

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

function toJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
    },
  })
}

function toErrorResponse(message: string, status: number): Response {
  return toJsonResponse({ error: message }, status)
}

function parsePositiveNumber(value: string | null, fallback: number): number {
  if (value === null || value.trim().length === 0) {
    return fallback
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback
  }

  return Math.floor(parsed)
}

function parseSortOption(value: string | null): SortOption {
  if (value === "createdAt:asc") {
    return "createdAt:asc"
  }

  return "createdAt:desc"
}

export function createApiHandler(repository: PostRepository) {
  return async function handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      })
    }

    if (request.method !== "GET") {
      return toErrorResponse("Method not allowed", 405)
    }

    if (url.pathname === "/api/boards") {
      return toJsonResponse({
        items: repository.getBoards(),
      })
    }

    if (url.pathname === "/api/posts") {
      const board = url.searchParams.get("board")?.trim() || undefined
      const q = url.searchParams.get("q")?.trim() || undefined
      const page = parsePositiveNumber(url.searchParams.get("page"), 1)
      const pageSize = parsePositiveNumber(url.searchParams.get("pageSize"), 20)
      const sort = parseSortOption(url.searchParams.get("sort"))

      try {
        const response = repository.listPosts({
          board,
          q,
          page,
          pageSize,
          sort,
        })

        return toJsonResponse(response)
      } catch (error) {
        if (error instanceof InvalidBoardError) {
          return toErrorResponse(error.message, 400)
        }

        console.error(error)
        return toErrorResponse("Internal server error", 500)
      }
    }

    const detailMatch = url.pathname.match(/^\/api\/posts\/([^/]+)\/(\d+)$/)
    if (detailMatch) {
      const board = decodeURIComponent(detailMatch[1])
      const articleId = Number(detailMatch[2])

      try {
        const detail = repository.getPostDetail(board, articleId)
        if (!detail) {
          return toErrorResponse("Post not found", 404)
        }

        return toJsonResponse(detail)
      } catch (error) {
        if (error instanceof InvalidBoardError) {
          return toErrorResponse(error.message, 400)
        }

        console.error(error)
        return toErrorResponse("Internal server error", 500)
      }
    }

    return toErrorResponse("Not found", 404)
  }
}
