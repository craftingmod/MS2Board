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

  $: query = (searchParams.get("q") ?? "").trim()
  $: page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1)
  $: boardFromQuery = (searchParams.get("board") ?? "").trim()
  $: effectiveBoardSlug = forcedBoardSlug ?? (boardFromQuery || undefined)
  $: selectedBoardName =
    forcedBoardSlug === null
      ? null
      : (boards.find((board) => board.slug === forcedBoardSlug)?.displayName ??
        forcedBoardSlug)

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
    if (nextPage < 1) {
      return
    }

    const nextParams = new URLSearchParams(searchParams)
    nextParams.set("page", String(nextPage))

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

    <div class="row" style="margin-top: 14px; justify-content: flex-end;">
      <button
        type="button"
        disabled={page <= 1}
        on:click={() => movePage(page - 1)}
      >
        Previous
      </button>
      <span class="meta">Page {result.page} / {totalPages()}</span>
      <button
        type="button"
        disabled={!result.hasNext}
        on:click={() => movePage(page + 1)}
      >
        Next
      </button>
    </div>
  {/if}
</section>
