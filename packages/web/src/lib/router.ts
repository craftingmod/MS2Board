export type AppRoute =
  | { kind: "home" }
  | { kind: "board"; slug: string }
  | { kind: "post"; slug: string; articleId: number }
  | { kind: "not-found" }

export function parseRoute(pathname: string): AppRoute {
  if (pathname === "/") {
    return { kind: "home" }
  }

  const boardMatch = pathname.match(/^\/board\/([^/]+)$/)
  if (boardMatch) {
    return {
      kind: "board",
      slug: decodeURIComponent(boardMatch[1]),
    }
  }

  const postMatch = pathname.match(/^\/post\/([^/]+)\/(\d+)$/)
  if (postMatch) {
    return {
      kind: "post",
      slug: decodeURIComponent(postMatch[1]),
      articleId: Number(postMatch[2]),
    }
  }

  return { kind: "not-found" }
}

export function buildQueryString(params: URLSearchParams): string {
  const stringified = params.toString()
  return stringified.length === 0 ? "" : `?${stringified}`
}
