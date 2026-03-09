import { type SortOption } from "@ms2board/common"
import { readdir } from "node:fs/promises"
import path from "node:path"
import { InvalidBoardError, type PostRepository } from "./repository"

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

const IMAGE_ROUTE_PREFIX = "/images/"
const EVENTS_ROUTE_PREFIX = "/events"
const RES_ROUTE_PREFIX = "/res/"
const DEFAULT_IMAGES_ROOT_DIR = path.resolve(
  import.meta.dir,
  "../../build/data/images",
)
const DEFAULT_FSE_ROOT_DIR = path.resolve(import.meta.dir, "../../build/data/fse")

type ApiHandlerOptions = {
  imagesRootDir?: string
  fseRootDir?: string
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

function parseSafePathSegments(rawPath: string): string[] | null {
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

  return segments
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

  const segments = parseSafePathSegments(rawPath)
  if (!segments) {
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

function resolveResPath(requestPath: string, fseRootDir: string): string | null {
  if (!requestPath.startsWith(RES_ROUTE_PREFIX)) {
    return null
  }

  const rawPath = requestPath.slice(RES_ROUTE_PREFIX.length)
  if (rawPath.length === 0) {
    return null
  }

  const segments = parseSafePathSegments(rawPath)
  if (!segments) {
    return null
  }

  const resRootDir = path.resolve(fseRootDir, "res")
  const resolvedPath = path.resolve(resRootDir, ...segments)
  const relativePath = path.relative(resRootDir, resolvedPath)
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null
  }

  return resolvedPath
}

function resolveEventHtmlPath(
  requestPath: string,
  fseRootDir: string,
): string | null {
  const pathMatch = requestPath.match(/^\/events\/([^/]+)\/([^/]+)\/?$/)
  if (!pathMatch) {
    return null
  }

  const dateSegment = decodeURIComponent(pathMatch[1]).trim()
  const nameSegment = decodeURIComponent(pathMatch[2]).trim()

  if (
    dateSegment.length === 0 ||
    nameSegment.length === 0 ||
    dateSegment.includes("/") ||
    nameSegment.includes("/") ||
    dateSegment.includes("\\") ||
    nameSegment.includes("\\") ||
    dateSegment.includes(":") ||
    nameSegment.includes(":")
  ) {
    return null
  }

  const fileName = `${dateSegment}_${nameSegment}.html`
  const resolvedPath = path.resolve(fseRootDir, fileName)
  const relativePath = path.relative(fseRootDir, resolvedPath)
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null
  }

  return resolvedPath
}

function resolveSimpleEventHtmlPath(
  requestPath: string,
  fseRootDir: string,
): string | null {
  const pathMatch = requestPath.match(/^\/events\/([^/]+)\/?$/)
  if (!pathMatch) {
    return null
  }

  const slug = decodeURIComponent(pathMatch[1]).trim()
  if (
    slug.length === 0 ||
    slug.includes("/") ||
    slug.includes("\\") ||
    slug.includes(":")
  ) {
    return null
  }

  const resolvedPath = path.resolve(fseRootDir, `${slug}.html`)
  const relativePath = path.relative(fseRootDir, resolvedPath)
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null
  }

  return resolvedPath
}

async function createEventsListHtml(fseRootDir: string): Promise<string> {
  const entries = await readdir(fseRootDir, { withFileTypes: true })
  const events = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
    .map((entry) => entry.name.slice(0, -".html".length))
    .map((baseName) => {
      const underscoreIndex = baseName.indexOf("_")
      const hasDateNamePattern =
        underscoreIndex > 0 &&
        underscoreIndex < baseName.length - 1 &&
        /^\d{8}$/.test(baseName.slice(0, underscoreIndex))

      if (hasDateNamePattern) {
        const date = baseName.slice(0, underscoreIndex)
        const name = baseName.slice(underscoreIndex + 1)
        return {
          baseName,
          href: `/events/${encodeURIComponent(date)}/${encodeURIComponent(name)}`,
        }
      }

      return {
        baseName,
        href: `/events/${encodeURIComponent(baseName)}`,
      }
    })
    .sort((a, b) => b.baseName.localeCompare(a.baseName))

  const itemsHtml = events
    .map((event) => `<li><a href="${event.href}">${event.baseName}</a></li>`)
    .join("\n")

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>MS2 FullScreen Events</title>
  <style>
    :root {
      color-scheme: light;
      font-family: "Segoe UI", Tahoma, Arial, sans-serif;
    }
    body {
      margin: 0;
      background: linear-gradient(120deg, #f4f8ff, #eefaf2);
      color: #1f2a37;
    }
    .wrap {
      max-width: 960px;
      margin: 40px auto;
      padding: 24px;
    }
    h1 {
      margin: 0 0 16px;
      font-size: 28px;
    }
    .desc {
      margin: 0 0 20px;
      color: #4b5563;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 10px;
    }
    li a {
      display: block;
      padding: 12px 14px;
      border-radius: 10px;
      text-decoration: none;
      color: #0f172a;
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid #dbe4f0;
    }
    li a:hover {
      background: #ffffff;
      border-color: #93c5fd;
    }
  </style>
</head>
<body>
  <main class="wrap">
    <h1>FullScreen Events</h1>
    <p class="desc">Open a full-screen event page from the list below.</p>
    <ul>
${itemsHtml}
    </ul>
  </main>
</body>
</html>`
}

function rewriteEventHtmlResourcePaths(html: string): string {
  return html
    .replace(
      /(src|href)\s*=\s*(["'])res\//gi,
      (_match, attr: string, quote: string) => `${attr}=${quote}/res/`,
    )
    .replace(
      /url\(\s*(["']?)res\//gi,
      (_match, quote: string) => `url(${quote}/res/`,
    )
}

export function createApiHandler(
  repository: PostRepository,
  options: ApiHandlerOptions = {},
) {
  const imagesRootDir = options.imagesRootDir ?? DEFAULT_IMAGES_ROOT_DIR
  const fseRootDir = options.fseRootDir ?? DEFAULT_FSE_ROOT_DIR

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

    if (url.pathname.startsWith(RES_ROUTE_PREFIX)) {
      const filePath = resolveResPath(url.pathname, fseRootDir)
      if (!filePath) {
        return toErrorResponse("Invalid res path", 400)
      }

      const file = Bun.file(filePath)
      if (!(await file.exists())) {
        return toErrorResponse("Resource not found", 404)
      }

      return new Response(file, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": file.type || "application/octet-stream",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      })
    }

    if (url.pathname === EVENTS_ROUTE_PREFIX || url.pathname === "/events/") {
      try {
        const html = await createEventsListHtml(fseRootDir)
        return new Response(html, {
          status: 200,
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "text/html; charset=utf-8",
          },
        })
      } catch (error) {
        console.error(error)
        return toErrorResponse("Internal server error", 500)
      }
    }

    if (url.pathname.startsWith(`${EVENTS_ROUTE_PREFIX}/`)) {
      const filePath =
        resolveEventHtmlPath(url.pathname, fseRootDir) ??
        resolveSimpleEventHtmlPath(url.pathname, fseRootDir)
      if (!filePath) {
        return toErrorResponse("Invalid event path", 400)
      }

      const file = Bun.file(filePath)
      if (!(await file.exists())) {
        return toErrorResponse("Event not found", 404)
      }

      const rawHtml = await file.text()
      const rewrittenHtml = rewriteEventHtmlResourcePaths(rawHtml)

      return new Response(rewrittenHtml, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "text/html; charset=utf-8",
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
