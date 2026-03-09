import { type SortOption } from "@ms2board/common"
import path from "node:path"
import { InvalidBoardError, type PostRepository } from "./repository"

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

const IMAGE_ROUTE_PREFIX = "/images/"
const DEFAULT_IMAGES_ROOT_DIR = path.resolve(
  import.meta.dir,
  "../../build/data/images",
)

type ApiHandlerOptions = {
  imagesRootDir?: string
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

function resolveImagePath(
  requestPath: string,
  imagesRootDir: string,
): string | null {
  if (!requestPath.startsWith(IMAGE_ROUTE_PREFIX)) {
    return null
  }

  const rawPath = requestPath.slice(IMAGE_ROUTE_PREFIX.length)
  if (rawPath.length === 0) {
    return null
  }

  let decodedPath = ""
  try {
    decodedPath = decodeURIComponent(rawPath)
  } catch {
    return null
  }

  const segments = decodedPath
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)

  if (
    segments.length === 0 ||
    segments.some(
      (segment) =>
        segment === "." ||
        segment === ".." ||
        segment.includes("\\") ||
        segment.includes(":"),
    )
  ) {
    return null
  }

  const fileName = segments[segments.length - 1]
  const dotIndex = fileName.lastIndexOf(".")
  const baseName = dotIndex >= 0 ? fileName.slice(0, dotIndex) : fileName
  if (baseName.length === 0) {
    return null
  }

  segments[segments.length - 1] = `${baseName}.avif`

  const resolvedPath = path.resolve(imagesRootDir, ...segments)
  const relativePath = path.relative(imagesRootDir, resolvedPath)

  if (
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath) ||
    relativePath.length === 0
  ) {
    return null
  }

  return resolvedPath
}

export function createApiHandler(
  repository: PostRepository,
  options: ApiHandlerOptions = {},
) {
  const imagesRootDir = options.imagesRootDir ?? DEFAULT_IMAGES_ROOT_DIR

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

    if (url.pathname.startsWith(IMAGE_ROUTE_PREFIX)) {
      const filePath = resolveImagePath(url.pathname, imagesRootDir)
      if (!filePath) {
        return toErrorResponse("Invalid image path", 400)
      }

      const file = Bun.file(filePath)
      if (!(await file.exists())) {
        return toErrorResponse("Image not found", 404)
      }

      return new Response(file, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": file.type || "image/avif",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      })
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

    const commentsMatch = url.pathname.match(
      /^\/api\/posts\/([^/]+)\/(\d+)\/comments$/,
    )

    if (commentsMatch) {
      const board = decodeURIComponent(commentsMatch[1])
      const articleId = Number(commentsMatch[2])
      const page = parsePositiveNumber(url.searchParams.get("page"), 1)
      const pageSize = parsePositiveNumber(url.searchParams.get("pageSize"), 20)

      try {
        const response = repository.listPostComments(board, articleId, {
          page,
          pageSize,
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
