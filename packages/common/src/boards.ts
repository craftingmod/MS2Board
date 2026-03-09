import type { BoardDefinition, BoardMeta, BoardSlug } from "./types"

export const BOARD_DEFINITIONS = [
  {
    slug: "free",
    displayName: "Free Board",
    tableName: "FreeBoard",
    defaultSort: "createdAt:desc",
  },
  {
    slug: "proposal",
    displayName: "Proposal Board",
    tableName: "ProposalBoard",
    defaultSort: "createdAt:desc",
  },
  {
    slug: "artwork",
    displayName: "Artwork Board",
    tableName: "ArtworkBoard",
    defaultSort: "createdAt:desc",
  },
  {
    slug: "guild",
    displayName: "Guild Board",
    tableName: "GuildBoard",
    defaultSort: "createdAt:desc",
  },
  {
    slug: "knowhow",
    displayName: "Knowhow Board",
    tableName: "KnowhowBoard",
    defaultSort: "createdAt:desc",
  },
  {
    slug: "notice",
    displayName: "Notice Board",
    tableName: "NoticeBoard",
    defaultSort: "createdAt:desc",
  },
  {
    slug: "news",
    displayName: "News Board",
    tableName: "NewsBoard",
    defaultSort: "createdAt:desc",
  },
  {
    slug: "patchnote",
    displayName: "Patchnote Board",
    tableName: "PatchnoteBoard",
    defaultSort: "createdAt:desc",
  },
  {
    slug: "cashshop",
    displayName: "Cashshop Board",
    tableName: "CashshopBoard",
    defaultSort: "createdAt:desc",
  },
  {
    slug: "events",
    displayName: "Events Board",
    tableName: "EventsBoard",
    defaultSort: "createdAt:desc",
  },
  {
    slug: "qna",
    displayName: "QnA Board",
    tableName: "QnABoard",
    defaultSort: "createdAt:desc",
  },
  {
    slug: "events-result-view",
    displayName: "Event Results",
    tableName: "EventsResultViewBoard",
    defaultSort: "createdAt:desc",
  },
] as const satisfies readonly BoardDefinition[]

const BOARD_SLUG_SET: Set<string> = new Set(
  BOARD_DEFINITIONS.map((board) => board.slug),
)

export function isBoardSlug(value: string): value is BoardSlug {
  return BOARD_SLUG_SET.has(value)
}

export function getBoardDefinitionBySlug(slug: BoardSlug): BoardDefinition {
  const found = BOARD_DEFINITIONS.find((board) => board.slug === slug)
  if (!found) {
    throw new Error(`Unsupported board slug: ${slug}`)
  }

  return found
}

export function toBoardMeta(board: BoardDefinition): BoardMeta {
  return {
    slug: board.slug,
    displayName: board.displayName,
    defaultSort: board.defaultSort,
  }
}

export const BOARD_META_LIST: BoardMeta[] = BOARD_DEFINITIONS.map((board) =>
  toBoardMeta(board),
)
