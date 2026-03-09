import { type Database } from "bun:sqlite"
import {
  getBoardDefinitionBySlug,
  isBoardSlug,
  type BoardMeta,
  type BoardSlug,
  type PagedResponse,
  type PostComment,
  type PostDetail,
  type PostListItem,
  type SortOption,
} from "@ms2board/common"
import {
  BOARD_QUERY_CONFIGS,
  type BoardQueryConfig,
} from "./board_query_config"

type QueryValue = string | number | null

type ListPostsOptions = {
  board?: string
  q?: string
  page?: number
  pageSize?: number
  sort?: SortOption
}

type ListPostCommentsOptions = {
  page?: number
  pageSize?: number
}

type RawListRow = {
  boardSlug: BoardSlug
  boardDisplayName: string
  boardDefaultSort: SortOption
  articleId: number
  title: string | null
  authorName: string
  createdAt: number
  viewCount: number | null
  likeCount: number | null
  commentCount: number
  summary: string | null
}

type RawDetailRow = RawListRow & {
  authorJob: number | null
  authorLevel: number | null
  authorIcon: string | null
  tags: string | null
  content: string | null
  attachments: string | null
}

type RawCommentRow = {
  commentIndex: number
  authorName: string
  content: string
  createdAt: number
}

export class InvalidBoardError extends Error {
  constructor(board: string) {
    super(`Unsupported board slug: ${board}`)
    this.name = "InvalidBoardError"
  }
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

function toIso(createdAt: number): string {
  return new Date(createdAt).toISOString()
}

function normalizePositiveInt(
  value: number | undefined,
  fallback: number,
  maximum?: number,
): number {
  if (!value || !Number.isFinite(value)) {
    return fallback
  }

  const normalized = Math.max(1, Math.floor(value))
  if (maximum === undefined) {
    return normalized
  }

  return Math.min(normalized, maximum)
}

function resolveBoardConfig(
  board: string,
  boardConfigs: readonly BoardQueryConfig[],
): BoardQueryConfig {
  if (!isBoardSlug(board)) {
    throw new InvalidBoardError(board)
  }

  const resolved = boardConfigs.find((config) => config.slug === board)
  if (!resolved) {
    throw new InvalidBoardError(board)
  }

  return resolved
}

function buildListSelect(
  config: BoardQueryConfig,
  searchPattern?: string,
): { sql: string; params: QueryValue[] } {
  const whereClause =
    searchPattern === undefined
      ? ""
      : `WHERE (${config.searchTextExpr} LIKE ? ESCAPE '\\' OR authorName LIKE ? ESCAPE '\\')`

  const selectSql = `
SELECT
  ${sqlLiteral(config.slug)} AS boardSlug,
  ${sqlLiteral(config.displayName)} AS boardDisplayName,
  ${sqlLiteral(config.defaultSort)} AS boardDefaultSort,
  articleId,
  ${config.titleExpr} AS title,
  authorName,
  createdAt,
  ${config.viewCountExpr} AS viewCount,
  ${config.likeCountExpr} AS likeCount,
  commentCount,
  ${config.summaryExpr} AS summary
FROM ${config.tableName}
${whereClause}
`.trim()

  const params =
    searchPattern === undefined ? [] : [searchPattern, searchPattern]

  return {
    sql: selectSql,
    params,
  }
}

function mapBoardMeta(row: RawListRow): BoardMeta {
  return {
    slug: row.boardSlug,
    displayName: row.boardDisplayName,
    defaultSort: row.boardDefaultSort,
  }
}

function mapListRow(row: RawListRow): PostListItem {
  return {
    board: mapBoardMeta(row),
    articleId: row.articleId,
    title: row.title,
    authorName: row.authorName,
    createdAt: toIso(row.createdAt),
    viewCount: row.viewCount,
    likeCount: row.likeCount,
    commentCount: row.commentCount,
    summary: row.summary,
  }
}

function mapDetailRow(row: RawDetailRow): PostDetail {
  return {
    ...mapListRow(row),
    authorJob: row.authorJob,
    authorLevel: row.authorLevel,
    authorIcon: row.authorIcon,
    tags: row.tags,
    content: row.content,
    attachments: row.attachments,
  }
}

function mapCommentRow(row: RawCommentRow): PostComment {
  return {
    commentIndex: row.commentIndex,
    authorName: row.authorName,
    content: row.content,
    createdAt: toIso(row.createdAt),
  }
}

export type PostRepository = ReturnType<typeof createPostRepository>

export function createPostRepository(
  db: Database,
  boardConfigs: readonly BoardQueryConfig[] = BOARD_QUERY_CONFIGS,
) {
  const boardMetaList = boardConfigs.map((config) => {
    const boardDefinition = getBoardDefinitionBySlug(config.slug)
    return {
      slug: boardDefinition.slug,
      displayName: boardDefinition.displayName,
      defaultSort: boardDefinition.defaultSort,
    }
  })

  function listPosts(options: ListPostsOptions): PagedResponse<PostListItem> {
    const normalizedPage = normalizePositiveInt(options.page, 1)
    const normalizedPageSize = normalizePositiveInt(options.pageSize, 20, 50)
    const normalizedSort: SortOption =
      options.sort === "createdAt:asc" ? "createdAt:asc" : "createdAt:desc"

    const boardFilter = options.board?.trim() || undefined
    const searchQuery = options.q?.trim() || undefined
    const searchPattern =
      searchQuery === undefined
        ? undefined
        : `%${escapeLikePattern(searchQuery)}%`

    const targetConfigs =
      boardFilter === undefined
        ? boardConfigs
        : [resolveBoardConfig(boardFilter, boardConfigs)]

    const unionParts: string[] = []
    const baseParams: QueryValue[] = []

    for (const config of targetConfigs) {
      const { sql, params } = buildListSelect(config, searchPattern)
      unionParts.push(sql)
      baseParams.push(...params)
    }

    const unionSql = unionParts.join("\nUNION ALL\n")
    const countSql = `SELECT COUNT(*) AS total FROM (${unionSql}) AS union_rows`

    const countStatement = db.query(countSql)
    const countRow = countStatement.get(...baseParams) as {
      total: number
    } | null
    const total = countRow?.total ?? 0

    const sortDirection = normalizedSort === "createdAt:asc" ? "ASC" : "DESC"
    const offset = (normalizedPage - 1) * normalizedPageSize
    const listSql = `
SELECT *
FROM (${unionSql}) AS union_rows
ORDER BY createdAt ${sortDirection}, articleId DESC
LIMIT ? OFFSET ?
`.trim()

    const listStatement = db.query(listSql)
    const rows = listStatement.all(
      ...baseParams,
      normalizedPageSize,
      offset,
    ) as RawListRow[]

    const items = rows.map((row) => mapListRow(row))

    return {
      items,
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: offset + items.length < total,
    }
  }

  function getPostDetail(board: string, articleId: number): PostDetail | null {
    const config = resolveBoardConfig(board, boardConfigs)
    const detailSql = `
SELECT
  ${sqlLiteral(config.slug)} AS boardSlug,
  ${sqlLiteral(config.displayName)} AS boardDisplayName,
  ${sqlLiteral(config.defaultSort)} AS boardDefaultSort,
  articleId,
  ${config.titleExpr} AS title,
  authorName,
  createdAt,
  ${config.viewCountExpr} AS viewCount,
  ${config.likeCountExpr} AS likeCount,
  commentCount,
  ${config.summaryExpr} AS summary,
  authorJob,
  authorLevel,
  ${config.authorIconExpr} AS authorIcon,
  tags,
  ${config.contentExpr} AS content,
  ${config.attachmentsExpr} AS attachments
FROM ${config.tableName}
WHERE articleId = ?
LIMIT 1
`.trim()

    const detailStatement = db.query(detailSql)
    const row = detailStatement.get(articleId) as RawDetailRow | null

    if (!row) {
      return null
    }

    return mapDetailRow(row)
  }

  function listPostComments(
    board: string,
    articleId: number,
    options: ListPostCommentsOptions = {},
  ): PagedResponse<PostComment> {
    const config = resolveBoardConfig(board, boardConfigs)
    const normalizedPage = normalizePositiveInt(options.page, 1)
    const normalizedPageSize = normalizePositiveInt(options.pageSize, 20, 50)
    const offset = (normalizedPage - 1) * normalizedPageSize

    const countSql = `
SELECT COUNT(*) AS total
FROM ${config.commentTableName}
WHERE articleId = ?
`.trim()

    const countStatement = db.query(countSql)
    const countRow = countStatement.get(articleId) as { total: number } | null
    const total = countRow?.total ?? 0

    const commentsSql = `
SELECT
  commentIndex,
  authorName,
  content,
  createdAt
FROM ${config.commentTableName}
WHERE articleId = ?
ORDER BY commentIndex DESC, createdAt DESC
LIMIT ? OFFSET ?
`.trim()

    const commentsStatement = db.query(commentsSql)
    const rows = commentsStatement.all(
      articleId,
      normalizedPageSize,
      offset,
    ) as RawCommentRow[]

    const items = rows.map((row) => mapCommentRow(row))

    return {
      items,
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasNext: offset + items.length < total,
    }
  }

  return {
    getBoards(): BoardMeta[] {
      return boardMetaList
    },
    listPosts,
    getPostDetail,
    listPostComments,
  }
}
