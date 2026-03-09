<script lang="ts">
  import { onMount } from "svelte"
  import type { BoardMeta } from "@ms2board/common"
  import { fetchBoards } from "./lib/api"
  import { buildQueryString, parseRoute } from "./lib/router"
  import PostDetailPage from "./components/PostDetailPage.svelte"
  import PostListPage from "./components/PostListPage.svelte"

  let currentUrl = new URL(window.location.href)
  let boards: BoardMeta[] = []
  let boardLoadError = ""

  async function loadBoards(): Promise<void> {
    boardLoadError = ""

    try {
      boards = await fetchBoards()
    } catch (error) {
      boardLoadError =
        error instanceof Error ? error.message : "Failed to load boards"
    }
  }

  function syncCurrentUrl(): void {
    currentUrl = new URL(window.location.href)
  }

  function navigate(path: string, params = new URLSearchParams()): void {
    const nextUrl = `${path}${buildQueryString(params)}`
    window.history.pushState({}, "", nextUrl)
    syncCurrentUrl()
  }

  onMount(() => {
    const onPopState = () => syncCurrentUrl()
    window.addEventListener("popstate", onPopState)
    void loadBoards()

    return () => {
      window.removeEventListener("popstate", onPopState)
    }
  })

  $: route = parseRoute(currentUrl.pathname)
  $: searchParams = new URLSearchParams(currentUrl.search)
</script>

<main>
  <h1>MS2 Archive</h1>
  <p class="meta">
    Browse archived MapleStory2 board posts from <code>ms2archive.db</code>.
  </p>

  {#if boardLoadError}
    <p class="card">Failed to load board metadata: {boardLoadError}</p>
  {/if}

  {#if route.kind === "home"}
    <PostListPage
      {boards}
      forcedBoardSlug={null}
      {searchParams}
      onNavigate={navigate}
    />
  {:else if route.kind === "board"}
    <PostListPage
      {boards}
      forcedBoardSlug={route.slug}
      {searchParams}
      onNavigate={navigate}
    />
  {:else if route.kind === "post"}
    <PostDetailPage
      boardSlug={route.slug}
      articleId={route.articleId}
      {boards}
      onNavigate={navigate}
    />
  {:else}
    <section class="card">
      <h2>Not Found</h2>
      <p>The requested route does not exist.</p>
      <a href="/" on:click|preventDefault={() => navigate("/")}>Go to home</a>
    </section>
  {/if}
</main>
