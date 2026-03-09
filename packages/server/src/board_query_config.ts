import {
  BOARD_DEFINITIONS,
  type BoardDefinition,
  type BoardSlug,
} from "@ms2board/common"

export type BoardQueryConfig = BoardDefinition & {
  titleExpr: string
  searchTextExpr: string
  summaryExpr: string
  viewCountExpr: string
  likeCountExpr: string
  authorIconExpr: string
  contentExpr: string
  attachmentsExpr: string
  hasTitleColumn: boolean
  commentTableName: string
}

const QUERY_OVERRIDES: Partial<Record<BoardSlug, Partial<BoardQueryConfig>>> = {
  qna: {
    titleExpr: "substr(content, 1, 80)",
    searchTextExpr: "content",
    summaryExpr: "NULL",
    viewCountExpr: "NULL",
    likeCountExpr: "NULL",
    authorIconExpr: "NULL",
    contentExpr: "content",
    attachmentsExpr: "NULL",
    hasTitleColumn: false,
  },
  events: {
    summaryExpr: "summary",
  },
  cashshop: {
    summaryExpr: "summary",
  },
}

export const BOARD_QUERY_CONFIGS: BoardQueryConfig[] = BOARD_DEFINITIONS.map(
  (board) => {
    const defaults: BoardQueryConfig = {
      ...board,
      titleExpr: "title",
      searchTextExpr: "title",
      summaryExpr: "NULL",
      viewCountExpr: "viewCount",
      likeCountExpr: "likeCount",
      authorIconExpr: "authorIcon",
      contentExpr: "content",
      attachmentsExpr: "attachments",
      hasTitleColumn: true,
      commentTableName: board.tableName.replace(/Board$/, "Comment"),
    }

    return {
      ...defaults,
      ...QUERY_OVERRIDES[board.slug as BoardSlug],
    }
  },
)
