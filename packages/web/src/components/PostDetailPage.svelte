<script lang="ts">
  import type { BoardMeta, PostDetail } from "@ms2board/common"
  import { fetchPostDetail } from "../lib/api"
  import { formatDateTime } from "../lib/format"

  export let boardSlug: string
  export let articleId: number
  export let boards: BoardMeta[] = []
  export let onNavigate: (
    path: string,
    params: URLSearchParams,
  ) => void = () => {
    // no-op default for type safety
  }

  let loading = false
  let errorMessage = ""
  let post: PostDetail | null = null
  let activeRequestToken = 0

  $: void loadDetail(boardSlug, articleId)
  $: boardName =
    boards.find((board) => board.slug === boardSlug)?.displayName ?? boardSlug

  async function loadDetail(slug: string, id: number): Promise<void> {
    const token = ++activeRequestToken
    loading = true
    errorMessage = ""

    try {
      const payload = await fetchPostDetail(slug, id)
      if (token !== activeRequestToken) {
        return
      }

      post = payload
    } catch (error) {
      if (token !== activeRequestToken) {
        return
      }

      post = null
      errorMessage =
        error instanceof Error ? error.message : "Failed to load post detail"
    } finally {
      if (token === activeRequestToken) {
        loading = false
      }
    }
  }
</script>

<section class="card" style="margin-top: 16px;">
  <div class="row" style="justify-content: space-between; margin-bottom: 12px;">
    <h2 style="margin: 0;">{boardName} Detail</h2>
    <div class="row">
      <a
        href={`/board/${boardSlug}`}
        on:click|preventDefault={() =>
          onNavigate(`/board/${boardSlug}`, new URLSearchParams())}
      >
        Back to board
      </a>
      <a
        href="/"
        on:click|preventDefault={() => onNavigate("/", new URLSearchParams())}
      >
        Home
      </a>
    </div>
  </div>

  {#if loading}
    <p>Loading detail...</p>
  {:else if errorMessage}
    <p>Failed to load post detail: {errorMessage}</p>
  {:else if post}
    <h3 style="margin-top: 0;">{post.title ?? "(No title)"}</h3>
    <p class="meta" style="margin-top: 0;">
      #{post.articleId} · {post.authorName} · {formatDateTime(post.createdAt)}
    </p>

    <p class="meta">
      Views {post.viewCount ?? "-"} · Likes {post.likeCount ?? "-"} · Comments {post.commentCount}
    </p>

    {#if post.summary}
      <p>{post.summary}</p>
    {/if}

    {#if post.content}
      <pre
        style="white-space: pre-wrap; overflow-wrap: anywhere; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">{post.content}</pre>
    {:else}
      <p>No content available.</p>
    {/if}
  {/if}
</section>
