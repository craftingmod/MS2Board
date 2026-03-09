<script lang="ts">
  import type { BoardMeta, PostComment, PostDetail } from "@ms2board/common"
  import { fetchPostComments, fetchPostDetail } from "../lib/api"
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
  let commentsLoading = false
  let errorMessage = ""
  let commentErrorMessage = ""
  let post: PostDetail | null = null
  let comments: PostComment[] = []
  let commentsTotal = 0
  let commentsHasNext = false
  let commentsPage = 1
  let commentsPageSize = 20
  let sanitizedContent = ""

  let activeDetailRequestToken = 0
  let activeCommentsRequestToken = 0
  let lastPostKey = ""

  $: currentPostKey = `${boardSlug}:${articleId}`
  $: if (currentPostKey !== lastPostKey) {
    lastPostKey = currentPostKey
    commentsPage = 1
    comments = []
    commentsTotal = 0
    commentsHasNext = false
    commentErrorMessage = ""
  }

  $: void loadDetail(boardSlug, articleId)
  $: void loadComments(boardSlug, articleId, commentsPage)
  $: boardName =
    boards.find((board) => board.slug === boardSlug)?.displayName ?? boardSlug
  $: sanitizedContent = post?.content ? sanitizeArchiveHtml(post.content) : ""

  async function loadDetail(slug: string, id: number): Promise<void> {
    const token = ++activeDetailRequestToken
    loading = true
    errorMessage = ""

    try {
      const payload = await fetchPostDetail(slug, id)
      if (token !== activeDetailRequestToken) {
        return
      }

      post = payload
    } catch (error) {
      if (token !== activeDetailRequestToken) {
        return
      }

      post = null
      errorMessage =
        error instanceof Error ? error.message : "Failed to load post detail"
    } finally {
      if (token === activeDetailRequestToken) {
        loading = false
      }
    }
  }

  async function loadComments(
    slug: string,
    id: number,
    page: number,
  ): Promise<void> {
    const token = ++activeCommentsRequestToken
    commentsLoading = true
    commentErrorMessage = ""

    try {
      const payload = await fetchPostComments(slug, id, page, commentsPageSize)
      if (token !== activeCommentsRequestToken) {
        return
      }

      comments = payload.items
      commentsTotal = payload.total
      commentsHasNext = payload.hasNext
    } catch (error) {
      if (token !== activeCommentsRequestToken) {
        return
      }

      comments = []
      commentsTotal = 0
      commentsHasNext = false
      commentErrorMessage =
        error instanceof Error ? error.message : "Failed to load comments"
    } finally {
      if (token === activeCommentsRequestToken) {
        commentsLoading = false
      }
    }
  }

  function totalCommentPages(): number {
    if (commentsTotal <= 0) {
      return 1
    }

    return Math.max(1, Math.ceil(commentsTotal / commentsPageSize))
  }

  function moveCommentPage(nextPage: number): void {
    const bounded = Math.max(1, Math.min(nextPage, totalCommentPages()))
    commentsPage = bounded
  }

  function visibleCommentPageNumbers(): number[] {
    const total = totalCommentPages()

    if (total <= 7) {
      return Array.from({ length: total }, (_, index) => index + 1)
    }

    if (commentsPage <= 4) {
      return [1, 2, 3, 4, 5, total]
    }

    if (commentsPage >= total - 3) {
      return [1, total - 4, total - 3, total - 2, total - 1, total]
    }

    return [1, commentsPage - 1, commentsPage, commentsPage + 1, total]
  }

  function shouldShowCommentEllipsisAfter(pageNumber: number): boolean {
    const numbers = visibleCommentPageNumbers()
    const index = numbers.indexOf(pageNumber)

    if (index < 0 || index === numbers.length - 1) {
      return false
    }

    return numbers[index + 1] - pageNumber > 1
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

    <section style="margin-top: 20px;">
      <h3 style="margin: 0 0 10px 0;">Comments ({commentsTotal})</h3>

      {#if commentErrorMessage}
        <p>Failed to load comments: {commentErrorMessage}</p>
      {:else if commentsLoading && comments.length === 0}
        <p class="meta">Loading comments...</p>
      {:else if comments.length === 0}
        <p class="meta">No comments.</p>
      {:else}
        <div style="display: flex; flex-direction: column; gap: 8px;">
          {#each comments as comment}
            <article class="comment-item">
              <p class="meta" style="margin: 0;">
                #{comment.commentIndex} · {comment.authorName} · {formatDateTime(
                  comment.createdAt,
                )}
              </p>
              <p class="comment-content">{comment.content}</p>
            </article>
          {/each}
        </div>

        <div class="row" style="margin-top: 12px; justify-content: flex-end;">
          <button
            type="button"
            disabled={commentsPage <= 1}
            on:click={() => moveCommentPage(commentsPage - 1)}
          >
            Previous
          </button>

          {#each visibleCommentPageNumbers() as pageNumber}
            <button
              type="button"
              class:active-page={pageNumber === commentsPage}
              aria-current={pageNumber === commentsPage ? "page" : undefined}
              on:click={() => moveCommentPage(pageNumber)}
            >
              {pageNumber}
            </button>

            {#if shouldShowCommentEllipsisAfter(pageNumber)}
              <span class="meta">...</span>
            {/if}
          {/each}

          <button
            type="button"
            disabled={!commentsHasNext}
            on:click={() => moveCommentPage(commentsPage + 1)}
          >
            Next
          </button>
        </div>
      {/if}
    </section>
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

  .comment-item {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #f8fafc;
    padding: 10px;
  }

  .comment-content {
    margin: 6px 0 0 0;
    white-space: pre-wrap;
  }

  .active-page {
    font-weight: 700;
    border: 1px solid #1d4ed8;
    color: #1d4ed8;
  }
</style>
