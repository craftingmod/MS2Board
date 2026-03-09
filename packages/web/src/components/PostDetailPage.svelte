<script lang="ts">
  import type { BoardMeta, PostDetail } from "@ms2board/common"
  import { fetchPostDetail } from "../lib/api"
  import { formatDateTime } from "../lib/format"
  import { sanitizeArchiveHtml } from "../lib/postContent"

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
  let sanitizedContent = ""
  let activeRequestToken = 0

  $: void loadDetail(boardSlug, articleId)
  $: boardName =
    boards.find((board) => board.slug === boardSlug)?.displayName ?? boardSlug
  $: sanitizedContent = post?.content ? sanitizeArchiveHtml(post.content) : ""

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

    {#if sanitizedContent}
      <div class="post-content">{@html sanitizedContent}</div>
    {:else}
      <p>No content available.</p>
    {/if}
  {/if}
</section>

<style>
  .post-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
    line-height: 1.5;
  }

  .post-content :global(img) {
    max-width: 100%;
    height: auto;
  }

  .post-content :global(p) {
    margin: 0;
  }

  .post-content :global(ul),
  .post-content :global(ol) {
    margin: 0;
    padding-left: 20px;
  }
</style>
