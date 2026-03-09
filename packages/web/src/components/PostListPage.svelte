<script lang="ts">
  import type { BoardMeta, PagedResponse, PostListItem } from "@ms2board/common"
  import { fetchPosts } from "../lib/api"
  import { formatDateTime } from "../lib/format"

  export let boards: BoardMeta[] = []
  export let forcedBoardSlug: string | null = null
  export let searchParams: URLSearchParams = new URLSearchParams()
  export let onNavigate: (
    path: string,
    params: URLSearchParams,
  ) => void = () => {
    // no-op default for type safety
  }

  let loading = false
  let errorMessage = ""
  let result: PagedResponse<PostListItem> | null = null
  let activeRequestToken = 0
  let jumpPageInput = "1"

  $: query = (searchParams.get("q") ?? "").trim()
  $: page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1)
  $: boardFromQuery = (searchParams.get("board") ?? "").trim()
  $: effectiveBoardSlug = forcedBoardSlug ?? (boardFromQuery || undefined)
  $: selectedBoardName =
    forcedBoardSlug === null
      ? null
      : (boards.find((board) => board.slug === forcedBoardSlug)?.displayName ??
        forcedBoardSlug)
  $: jumpPageInput = String(page)

  $: void loadPosts(effectiveBoardSlug, query, page)

  async function loadPosts(
    boardSlug: string | undefined,
    q: string,
    currentPage: number,
  ): Promise<void> {
    const token = ++activeRequestToken
    loading = true
    errorMessage = ""

    try {
      const payload = await fetchPosts({
        board: boardSlug,
        q: q.length > 0 ? q : undefined,
        page: currentPage,
        pageSize: 20,
      })

      if (token !== activeRequestToken) {
        return
      }

      result = payload
    } catch (error) {
      if (token !== activeRequestToken) {
        return
      }

      result = null
      errorMessage =
        error instanceof Error ? error.message : "Failed to fetch posts"
    } finally {
      if (token === activeRequestToken) {
        loading = false
      }
    }
  }

  function basePath(): string {
    if (forcedBoardSlug) {
      return `/board/${encodeURIComponent(forcedBoardSlug)}`
    }

    return "/"
  }

  function submitSearch(event: SubmitEvent): void {
    event.preventDefault()

    const form = event.currentTarget as HTMLFormElement
    const formData = new FormData(form)
    const nextQuery = String(formData.get("q") ?? "").trim()
    const nextBoard = String(formData.get("board") ?? "").trim()
    const nextParams = new URLSearchParams(searchParams)

    if (nextQuery.length > 0) {
      nextParams.set("q", nextQuery)
    } else {
      nextParams.delete("q")
    }

    nextParams.set("page", "1")

    if (forcedBoardSlug === null) {
      if (nextBoard.length > 0) {
        nextParams.set("board", nextBoard)
      } else {
        nextParams.delete("board")
      }
    } else {
      nextParams.delete("board")
    }

    onNavigate(basePath(), nextParams)
  }

  function movePage(nextPage: number): void {
    const maxPage = totalPages()
    const boundedPage = Math.max(1, Math.min(nextPage, maxPage))

    const nextParams = new URLSearchParams(searchParams)
    nextParams.set("page", String(boundedPage))

    if (forcedBoardSlug !== null) {
      nextParams.delete("board")
    }

    onNavigate(basePath(), nextParams)
  }

  function totalPages(): number {
    if (!result || result.total <= 0) {
      return 1
    }

    return Math.max(1, Math.ceil(result.total / result.pageSize))
  }

  function visiblePageNumbers(): number[] {
    const total = totalPages()

    if (total <= 7) {
      return Array.from({ length: total }, (_, index) => index + 1)
    }

    if (page <= 4) {
      return [1, 2, 3, 4, 5, total]
    }

    if (page >= total - 3) {
      return [1, total - 4, total - 3, total - 2, total - 1, total]
    }

    return [1, page - 1, page, page + 1, total]
  }

  function shouldShowEllipsisAfter(pageNumber: number): boolean {
    const numbers = visiblePageNumbers()
    const index = numbers.indexOf(pageNumber)
    if (index < 0 || index === numbers.length - 1) {
      return false
    }

    return numbers[index + 1] - pageNumber > 1
  }

  function submitJumpPage(event: SubmitEvent): void {
    event.preventDefault()

    const parsed = Number(jumpPageInput)
    if (!Number.isFinite(parsed)) {
      return
    }

    movePage(Math.floor(parsed))
  }
</script>

<section class="card" style="margin-top: 16px;">
  <div class="row" style="justify-content: space-between; margin-bottom: 8px;">
    <h2 style="margin: 0;">
      {forcedBoardSlug ? selectedBoardName : "All Boards"}
    </h2>
    {#if forcedBoardSlug}
      <a
        href="/"
        on:click|preventDefault={() => onNavigate("/", new URLSearchParams())}
      >
        View all boards
      </a>
    {/if}
  </div>

  <form
    on:submit={submitSearch}
    class="row"
    style="align-items: end; gap: 10px; margin-bottom: 12px;"
  >
    <label
      style="display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 220px;"
    >
      <span class="meta">Search title or author</span>
      <input type="text" name="q" value={query} placeholder="Search..." />
    </label>

    {#if forcedBoardSlug === null}
      <label
        style="display: flex; flex-direction: column; gap: 4px; min-width: 170px;"
      >
        <span class="meta">Board</span>
        <select name="board" value={boardFromQuery}>
          <option value="">All</option>
          {#each boards as board}
            <option value={board.slug}>{board.displayName}</option>
          {/each}
        </select>
      </label>
    {/if}

    <button type="submit">Apply</button>
  </form>

  {#if loading}
    <p>Loading posts...</p>
  {:else if errorMessage}
    <p>Failed to load posts: {errorMessage}</p>
  {:else if result && result.items.length === 0}
    <p>No posts found.</p>
  {:else if result}
    <p class="meta" style="margin: 0 0 12px 0;">Total {result.total} posts</p>

    <div style="display: flex; flex-direction: column; gap: 10px;">
      {#each result.items as item}
        <article class="card" style="padding: 12px;">
          <h3 style="margin: 0 0 6px 0;">
            <a
              href={`/post/${item.board.slug}/${item.articleId}`}
              on:click|preventDefault={() =>
                onNavigate(
                  `/post/${item.board.slug}/${item.articleId}`,
                  new URLSearchParams(),
                )}
            >
              {item.title ?? "(No title)"}
            </a>
          </h3>

          <p class="meta" style="margin: 0;">
            {item.board.displayName} · #{item.articleId} · {item.authorName} · {formatDateTime(
              item.createdAt,
            )}
          </p>
        </article>
      {/each}
    </div>

    <div class="row" style="margin-top: 14px; justify-content: space-between;">
      <div class="row">
        <button
          type="button"
          disabled={page <= 1}
          on:click={() => movePage(page - 1)}
        >
          Previous
        </button>

        {#each visiblePageNumbers() as pageNumber}
          <button
            type="button"
            class:active-page={pageNumber === page}
            on:click={() => movePage(pageNumber)}
            aria-current={pageNumber === page ? "page" : undefined}
          >
            {pageNumber}
          </button>

          {#if shouldShowEllipsisAfter(pageNumber)}
            <span class="meta">...</span>
          {/if}
        {/each}

        <button
          type="button"
          disabled={!result.hasNext}
          on:click={() => movePage(page + 1)}
        >
          Next
        </button>
      </div>

      <form class="row" on:submit={submitJumpPage} style="gap: 8px;">
        <label class="meta" for="jump-page">Go to</label>
        <input
          id="jump-page"
          type="number"
          min="1"
          max={totalPages()}
          bind:value={jumpPageInput}
          style="width: 84px;"
        />
        <button type="submit">Move</button>
      </form>
    </div>

    <p class="meta" style="margin: 8px 0 0 0; text-align: right;">
      Page {result.page} / {totalPages()}
    </p>
  {/if}
</section>

<style>
  .active-page {
    font-weight: 700;
    border: 1px solid #1d4ed8;
    color: #1d4ed8;
  }
</style>
