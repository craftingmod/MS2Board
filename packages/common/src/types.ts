export type BoardSlug =
  | "free"
  | "proposal"
  | "artwork"
  | "guild"
  | "knowhow"
  | "notice"
  | "news"
  | "patchnote"
  | "cashshop"
  | "events"
  | "qna"
  | "events-result-view"

export type SortOption = "createdAt:desc" | "createdAt:asc"

export type BoardDefinition = {
  slug: BoardSlug
  displayName: string
  tableName: string
  defaultSort: SortOption
}

export type BoardMeta = {
  slug: BoardSlug
  displayName: string
  defaultSort: SortOption
}

export type BoardWithTableMeta = BoardMeta & {
  tableName: string
}

export type PostListItem = {
  board: BoardMeta
  articleId: number
  title: string | null
  authorName: string
  createdAt: string
  viewCount: number | null
  likeCount: number | null
  commentCount: number
  summary: string | null
}

export type PostDetail = PostListItem & {
  authorJob: number | null
  authorLevel: number | null
  authorIcon: string | null
  tags: string | null
  content: string | null
  attachments: string | null
}

export type PostComment = {
  commentIndex: number
  authorName: string
  content: string
  createdAt: string
}

export type PagedResponse<T> = {
  items: T[]
  page: number
  pageSize: number
  total: number
  hasNext: boolean
}
