import type {
  BoardMeta,
  PagedResponse,
  PostComment,
  PostDetail,
  PostListItem,
  SortOption,
} from "@ms2board/common"

export type ListPostsQuery = {
  board?: string
  q?: string
  page?: number
  pageSize?: number
  sort?: SortOption
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ""

async function requestJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`)

  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const payload = (await response.json()) as { error?: string }
      if (payload.error) {
        message = payload.error
      }
    } catch {
      // Ignore JSON parse errors and keep fallback message.
    }

    throw new Error(message)
  }

  return (await response.json()) as T
}

export async function fetchBoards(): Promise<BoardMeta[]> {
  const payload = await requestJson<{ items: BoardMeta[] }>("/api/boards")
  return payload.items
}

export async function fetchPosts(
  query: ListPostsQuery,
): Promise<PagedResponse<PostListItem>> {
  const params = new URLSearchParams()

  if (query.board) {
    params.set("board", query.board)
  }

  if (query.q) {
    params.set("q", query.q)
  }

  if (query.page) {
    params.set("page", String(query.page))
  }

  if (query.pageSize) {
    params.set("pageSize", String(query.pageSize))
  }

  if (query.sort) {
    params.set("sort", query.sort)
  }

  const suffix = params.size > 0 ? `?${params.toString()}` : ""
  return requestJson<PagedResponse<PostListItem>>(`/api/posts${suffix}`)
}

export async function fetchPostDetail(
  boardSlug: string,
  articleId: number,
): Promise<PostDetail> {
  return requestJson<PostDetail>(
    `/api/posts/${encodeURIComponent(boardSlug)}/${articleId}`,
  )
}

export async function fetchPostComments(
  boardSlug: string,
  articleId: number,
  page = 1,
  pageSize = 20,
): Promise<PagedResponse<PostComment>> {
  const params = new URLSearchParams()
  params.set("page", String(page))
  params.set("pageSize", String(pageSize))

  return requestJson<PagedResponse<PostComment>>(
    `/api/posts/${encodeURIComponent(boardSlug)}/${articleId}/comments?${params.toString()}`,
  )
}
